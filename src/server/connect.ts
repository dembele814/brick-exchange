import type Stripe from "stripe";

export const CONNECT_FEE_FIXED_GROSZ = 100;
export const CONNECT_FEE_PERCENT = 5;

export function connectFeeGrosz(amountGrosz: number) {
  if (!Number.isSafeInteger(amountGrosz) || amountGrosz <= 0)
    throw new Error("Invalid order amount");
  return Math.min(
    amountGrosz,
    CONNECT_FEE_FIXED_GROSZ + Math.round((amountGrosz * CONNECT_FEE_PERCENT) / 100),
  );
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
        product_description: "Sprzedaż zestawów, minifigurek i klocków LEGO w Klockowni.",
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
