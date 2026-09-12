import type Stripe from "stripe";

export const CONNECT_FEE_FIXED_GROSZ = 100;
export const CONNECT_FEE_PERCENT = 5;

export function connectMetadataKey(liveMode: boolean) {
  return liveMode ? "klockownia_stripe_live_account_id" : "klockownia_stripe_test_account_id";
}

export function connectAccountIdFor(
  user: { app_metadata?: Record<string, unknown> },
  liveMode: boolean,
) {
  const value =
    user.app_metadata?.[connectMetadataKey(liveMode)] ??
    (!liveMode ? user.app_metadata?.["klockownia_stripe_account_id"] : undefined);
  return typeof value === "string" ? value : undefined;
}

export function connectFeeGrosz(amountGrosz: number) {
  if (!Number.isSafeInteger(amountGrosz) || amountGrosz <= 0)
    throw new Error("Invalid order amount");
  return CONNECT_FEE_FIXED_GROSZ + Math.round((amountGrosz * CONNECT_FEE_PERCENT) / 100);
}

export function sellerProceedsGrosz(amountGrosz: number) {
  connectFeeGrosz(amountGrosz);
  return amountGrosz;
}

export function connectAccountCreateParams(
  userId: string,
  email: string,
  appUrl: string,
): Stripe.V2.Core.AccountCreateParams {
  return {
    contact_email: email,
    dashboard: "express",
    defaults: {
      currency: "pln",
      locales: ["pl-PL"],
      profile: {
        business_url: appUrl,
        product_description: "Sprzedaż zestawów, minifigurek i klocków LEGO w Klockogramie.",
      },
      responsibilities: { fees_collector: "application", losses_collector: "application" },
    },
    identity: { country: "PL" },
    configuration: {
      recipient: {
        capabilities: { stripe_balance: { stripe_transfers: { requested: true } } },
      },
    },
    metadata: { klockownia_user_id: userId },
  };
}

export function connectState(account: Stripe.V2.Core.Account) {
  const capability =
    account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers;
  const status = capability?.status;
  return {
    state:
      status === "active"
        ? ("active" as const)
        : status === "restricted" || status === "unsupported"
          ? ("restricted" as const)
          : ("pending" as const),
    requiresInformation:
      capability?.status_details?.some((detail) => detail.resolution === "provide_info") ?? true,
  };
}

export type DeliveredTransferOrder = {
  id: string;
  amount_grosz: number;
  status: string;
  payment_status: string;
  stripe_payment_intent_id: string | null;
  stripe_livemode: boolean;
};

export async function createDeliveredTransfer(
  stripe: Stripe,
  accountId: string,
  order: DeliveredTransferOrder,
  expectedLiveMode: boolean,
) {
  if (
    order.status !== "delivered" ||
    order.payment_status !== "paid" ||
    !order.stripe_payment_intent_id
  )
    throw new Error("Order is not eligible for transfer");

  const account = await stripe.v2.core.accounts.retrieve(accountId, {
    include: ["configuration.recipient"],
  });
  if (connectState(account).state !== "active") return { state: "not_ready" as const };

  const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id, {
    expand: ["latest_charge"],
  });
  if (
    paymentIntent.livemode !== expectedLiveMode ||
    order.stripe_livemode !== expectedLiveMode ||
    paymentIntent.status !== "succeeded" ||
    paymentIntent.metadata["order_id"] !== order.id
  )
    throw new Error("Payment does not match the order");
  const latestCharge = paymentIntent.latest_charge;
  const chargeId = typeof latestCharge === "string" ? latestCharge : (latestCharge?.id ?? null);
  if (!chargeId) throw new Error("Payment charge is missing");

  const fallbackFee = connectFeeGrosz(order.amount_grosz);
  const storedFee = Number(paymentIntent.metadata["platform_fee_grosz"] ?? fallbackFee);
  const buyerFundedFee = paymentIntent.metadata["fee_payer"] === "buyer";
  if (!Number.isSafeInteger(storedFee) || storedFee < 0) throw new Error("Invalid fee snapshot");
  if (buyerFundedFee) {
    if (
      storedFee !== fallbackFee ||
      Number(paymentIntent.metadata["seller_amount_grosz"]) !== order.amount_grosz
    )
      throw new Error("Invalid buyer fee snapshot");
  } else if (storedFee > order.amount_grosz) {
    throw new Error("Invalid legacy fee snapshot");
  }
  const amount = buyerFundedFee ? order.amount_grosz : order.amount_grosz - storedFee;
  if (amount <= 0) return { state: "no_transfer" as const, amount: 0, fee: storedFee };

  const transfer = await stripe.transfers.create(
    {
      amount,
      currency: "pln",
      destination: accountId,
      source_transaction: chargeId,
      transfer_group: paymentIntent.transfer_group ?? `order_${order.id}`,
      metadata: {
        order_id: order.id,
        platform_fee_grosz: String(storedFee),
        integration: "klockownia_connect_v1",
      },
    },
    { idempotencyKey: `klockownia-transfer:${order.id}:v1` },
  );
  return { state: "transferred" as const, amount, fee: storedFee, transferId: transfer.id };
}
