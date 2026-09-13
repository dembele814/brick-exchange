import { createFileRoute } from "@tanstack/react-router";
import { reconciliationAuthorized, reconciliationSecret } from "@/server/reconciliation";
import { reconcileFurgonetkaShipping } from "@/server/shipping-reconciliation";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

export const Route = createFileRoute("/api/cron/shipping")({
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
          return Response.json(await reconcileFurgonetkaShipping(getSupabaseAdmin()));
        } catch {
          console.error("Shipping reconciliation run failed");
          return new Response("Shipping reconciliation failed", { status: 503 });
        }
      },
    },
  },
});
