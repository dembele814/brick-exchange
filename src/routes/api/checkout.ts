import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { getSupabaseAdmin } from "@/server/supabase-admin";
import { paymentConfig } from "@/server/payments";
import { handleCheckout } from "@/server/checkout-handler";
import { validateInpostPoint } from "@/server/inpost";
import { enforceRateLimit } from "@/server/rate-limit";

export const Route = createFileRoute("/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const config = paymentConfig(process.env, true);
          const admin = getSupabaseAdmin();
          return await handleCheckout(
            request,
            admin,
            new Stripe(config.key),
            config.appUrl,
            config.liveMode,
            validateInpostPoint,
            (userId) => enforceRateLimit(admin, "checkout", userId, 10, 60),
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
