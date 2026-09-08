import Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkoutEvent } from "./payments.ts";

export async function handleStripeWebhook(
  request: Request,
  stripe: Stripe,
  secret: string,
  getAdmin: () => SupabaseClient,
) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing Stripe signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await request.text(), signature, secret);
  } catch {
    return new Response("Invalid Stripe signature", { status: 400 });
  }
  try {
    const payload = checkoutEvent(event);
    if (payload) {
      const { error } = await getAdmin().rpc("apply_stripe_checkout_event", payload);
      if (error) throw new Error("Payment transaction failed");
    }
    return new Response("ok");
  } catch {
    console.error("Stripe webhook requires retry or investigation", event.id);
    return new Response("Payment event could not be applied", { status: 500 });
  }
}
