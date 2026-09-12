import Stripe from "stripe";
import { z } from "zod";
import { connectFeeGrosz } from "./connect.ts";

export const checkoutInput = z.object({
  listingId: z.string().uuid(),
  acceptedOfferId: z.string().uuid().optional(),
  lockerId: z.string().trim().min(3).max(80),
  carrier: z.enum(["inpost", "orlen", "dpd", "dhl"]),
  receiver: z.object({
    email: z.string().email(),
    phone: z.string().trim().min(7).max(30),
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
  }),
});

export function paymentConfig(
  env: Record<string, string | undefined> = process.env,
  creatingCheckout = false,
) {
  const mode = env["STRIPE_MODE"] ?? "test";
  if (mode !== "test" && mode !== "live") throw new Error("Invalid Stripe mode");
  const liveMode = mode === "live";
  const key = env["STRIPE_SECRET_KEY"];
  if (!key?.startsWith(liveMode ? "sk_live_" : "sk_test_") || !env["STRIPE_WEBHOOK_SECRET"])
    throw new Error("Stripe credentials do not match the configured mode");
  if (liveMode && env["STRIPE_LIVE_ENABLED"] !== "true")
    throw new Error("Live Stripe requires an explicit safety opt-in");
  if (creatingCheckout && env["STRIPE_PAYMENTS_ENABLED"] !== "true")
    throw new Error("Checkout is disabled");
  const url = new URL(env["APP_URL"] ?? "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    (url.protocol !== "https:" && !(local && url.protocol === "http:")) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("APP_URL must be a trusted application origin");
  if (liveMode && url.protocol !== "https:") throw new Error("Live Stripe requires HTTPS");
  return { key, webhookSecret: env["STRIPE_WEBHOOK_SECRET"], appUrl: url.origin, liveMode, mode };
}

export type CheckoutOrder = {
  id: string;
  listing_id: string;
  buyer_id: string;
  amount_grosz: number;
  checkout_title: string;
  checkout_origin: string;
  checkout_expires_at: number;
  stripe_checkout_session_id: string | null;
  stripe_livemode: boolean;
  accepted_offer_id?: string | null;
};

export function sessionParameters(order: CheckoutOrder): Stripe.Checkout.SessionCreateParams {
  const platformFeeGrosz = connectFeeGrosz(order.amount_grosz);
  const buyerTotalGrosz = order.amount_grosz + platformFeeGrosz;
  const transferGroup = `order_${order.id}`;
  return {
    mode: "payment",
    // Checkout uses Dashboard-managed payment methods by default.
    line_items: [
      {
        price_data: {
          currency: "pln",
          product_data: { name: order.checkout_title },
          unit_amount: buyerTotalGrosz,
        },
        quantity: 1,
      },
    ],
    client_reference_id: order.buyer_id,
    metadata: {
      order_id: order.id,
      integration: "klockownia_checkout_v1",
      fee_payer: "buyer",
      platform_fee_grosz: String(platformFeeGrosz),
      seller_amount_grosz: String(order.amount_grosz),
    },
    payment_intent_data: {
      transfer_group: transferGroup,
      metadata: {
        order_id: order.id,
        platform_fee_grosz: String(platformFeeGrosz),
        fee_payer: "buyer",
        seller_amount_grosz: String(order.amount_grosz),
        transfer_group: transferGroup,
        accepted_offer_id: order.accepted_offer_id ?? "",
      },
    },
    expires_at: order.checkout_expires_at,
    success_url: `${order.checkout_origin}/zamowienia?payment=success&order=${order.id}`,
    cancel_url: `${order.checkout_origin}/oferta/${order.listing_id}?payment=cancelled`,
  };
}

export async function refundPayment(
  stripe: Stripe,
  order: { id: string; stripe_payment_intent_id: string | null; stripe_livemode: boolean },
  expectedLiveMode: boolean,
) {
  if (!order.stripe_payment_intent_id) throw new Error("Payment intent is missing");
  const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  if (
    paymentIntent.livemode !== expectedLiveMode ||
    order.stripe_livemode !== expectedLiveMode ||
    paymentIntent.status !== "succeeded" ||
    paymentIntent.metadata["order_id"] !== order.id
  )
    throw new Error("Payment does not match the order");

  return stripe.refunds.create(
    {
      payment_intent: paymentIntent.id,
      reason: "requested_by_customer",
      metadata: { order_id: order.id, integration: "klockownia_refund_v1" },
    },
    { idempotencyKey: `klockownia-refund:${order.id}:v1` },
  );
}

export function checkoutEvent(event: Stripe.Event, expectedLiveMode = false) {
  if (event.livemode !== expectedLiveMode || event.account)
    throw new Error("Unexpected Stripe account or mode");
  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "checkout.session.async_payment_failed" &&
    event.type !== "checkout.session.expired"
  )
    return null;
  const session = event.data.object;
  // Legacy sessions must match a previously persisted session ID in Postgres.
  const orderId = session.metadata?.["order_id"];
  if (!orderId) return null;
  if (
    !z.string().uuid().safeParse(orderId).success ||
    session.mode !== "payment" ||
    session.livemode !== expectedLiveMode
  )
    throw new Error("Invalid Checkout order reference or mode");
  const success =
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded";
  if (success && session.payment_status !== "paid") return null;
  if (!success && session.payment_status === "paid")
    throw new Error("Paid session cannot release inventory");
  if (event.type === "checkout.session.expired" && session.status !== "expired")
    throw new Error("Session is not expired");
  if (
    !Number.isSafeInteger(session.amount_total) ||
    (session.amount_total ?? 0) <= 0 ||
    session.currency !== "pln"
  )
    throw new Error("Unexpected Checkout amount or currency");
  let orderAmount = session.amount_total;
  if (session.metadata?.["fee_payer"] === "buyer") {
    const fee = Number(session.metadata["platform_fee_grosz"]);
    const sellerAmount = Number(session.metadata["seller_amount_grosz"]);
    if (
      !Number.isSafeInteger(fee) ||
      !Number.isSafeInteger(sellerAmount) ||
      sellerAmount <= 0 ||
      fee !== connectFeeGrosz(sellerAmount) ||
      session.amount_total !== sellerAmount + fee
    )
      throw new Error("Unexpected buyer fee snapshot");
    orderAmount = sellerAmount;
  }
  return {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: orderId,
    p_session_id: session.id,
    p_amount: orderAmount,
    p_currency: session.currency,
    p_buyer_id: session.client_reference_id,
    p_integration: session.metadata?.["integration"] ?? null,
    p_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    p_paid: success,
    p_stripe_livemode: expectedLiveMode,
  };
}
