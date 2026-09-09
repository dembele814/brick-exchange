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
  // Real marketplace charging stays blocked until Connect and money operations ship.
  const key = env["STRIPE_SECRET_KEY"];
  if (!key?.startsWith("sk_test_") || !env["STRIPE_WEBHOOK_SECRET"])
    throw new Error("Test payment credentials are required");
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
  return { key, webhookSecret: env["STRIPE_WEBHOOK_SECRET"], appUrl: url.origin };
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
  accepted_offer_id?: string | null;
};

export function sessionParameters(order: CheckoutOrder): Stripe.Checkout.SessionCreateParams {
  const platformFeeGrosz = connectFeeGrosz(order.amount_grosz);
  const transferGroup = `order_${order.id}`;
  return {
    mode: "payment",
    // Checkout uses Dashboard-managed payment methods by default.
    line_items: [
      {
        price_data: {
          currency: "pln",
          product_data: { name: order.checkout_title },
          unit_amount: order.amount_grosz,
        },
        quantity: 1,
      },
    ],
    client_reference_id: order.buyer_id,
    metadata: { order_id: order.id, integration: "klockownia_checkout_v1" },
    payment_intent_data: {
      transfer_group: transferGroup,
      metadata: {
        order_id: order.id,
        platform_fee_grosz: String(platformFeeGrosz),
        transfer_group: transferGroup,
        accepted_offer_id: order.accepted_offer_id ?? "",
      },
    },
    expires_at: order.checkout_expires_at,
    success_url: `${order.checkout_origin}/zamowienia?payment=success&order=${order.id}`,
    cancel_url: `${order.checkout_origin}/oferta/${order.listing_id}?payment=cancelled`,
  };
}

export async function refundTestPayment(
  stripe: Stripe,
  order: { id: string; stripe_payment_intent_id: string | null },
) {
  if (!order.stripe_payment_intent_id) throw new Error("Payment intent is missing");
  const paymentIntent = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
  if (
    paymentIntent.livemode ||
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

export function checkoutEvent(event: Stripe.Event) {
  if (event.livemode || event.account) throw new Error("Unexpected Stripe account or mode");
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
    session.livemode
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
  return {
    p_event_id: event.id,
    p_event_type: event.type,
    p_order_id: orderId,
    p_session_id: session.id,
    p_amount: session.amount_total,
    p_currency: session.currency,
    p_buyer_id: session.client_reference_id,
    p_integration: session.metadata?.["integration"] ?? null,
    p_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null),
    p_paid: success,
  };
}
