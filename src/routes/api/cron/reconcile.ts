import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { paymentConfig } from "@/server/payments";
import {
  reconcileStripeMoney,
  reconciliationAuthorized,
  reconciliationSecret,
} from "@/server/reconciliation";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

export const Route = createFileRoute("/api/cron/reconcile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let secret: string;
        try {
          secret = reconciliationSecret();
        } catch {
          return new Response("Not configured", { status: 503 });
        }
        if (!reconciliationAuthorized(request, secret))
          return new Response("Unauthorized", { status: 401 });
        if (!hasSupabaseAdminConfig()) return new Response("Not configured", { status: 503 });
        try {
          const config = paymentConfig();
          const summary = await reconcileStripeMoney(
            getSupabaseAdmin(),
            new Stripe(config.key),
            config.liveMode,
          );
          return Response.json(summary);
        } catch {
          console.error("Stripe reconciliation run failed");
          return new Response("Reconciliation failed", { status: 503 });
        }
      },
    },
  },
});
