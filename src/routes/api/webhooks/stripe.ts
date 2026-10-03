import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/server/supabase-admin";
import { paymentConfig } from "@/server/payments";
import { handleStripeWebhook } from "@/server/stripe-webhook-handler";

export const Route = createFileRoute("/api/webhooks/stripe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!request.headers.get("stripe-signature"))
          return new Response("Missing Stripe signature", { status: 400 });
        let config: ReturnType<typeof paymentConfig>;
        try {
          config = paymentConfig();
        } catch {
          return new Response("Webhook is not configured", { status: 503 });
        }
        return handleStripeWebhook(
          request,
          new Stripe(config.key),
          config.webhookSecret,
          getSupabaseAdmin,
          config.liveMode,
        );
      },
    },
  },
});
