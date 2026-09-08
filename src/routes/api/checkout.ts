import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/server/supabase-admin";
import { paymentConfig } from "@/server/payments";
import { handleCheckout } from "@/server/checkout-handler";

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const config = paymentConfig(process.env, true);
          return await handleCheckout(
            request,
            getSupabaseAdmin(),
            new Stripe(config.key),
            config.appUrl,
          );
        } catch {
          console.error(
            "Stripe Checkout unavailable; reservation retained for retry/reconciliation",
          );
          return Response.json(
            { error: "Płatności są chwilowo niedostępne. Spróbuj ponownie później." },
            { status: 503 },
          );
        }
      },
    },
  },
});
