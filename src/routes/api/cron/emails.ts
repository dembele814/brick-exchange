import { createFileRoute } from "@tanstack/react-router";
import { emailConfig, emailWorkerSecret, processEmailOutbox } from "@/server/email";
import { reconciliationAuthorized } from "@/server/reconciliation";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

export const Route = createFileRoute("/api/cron/emails")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let secret: string;
        try {
          secret = emailWorkerSecret();
        } catch {
          return new Response("Not configured", { status: 503 });
        }
        if (!reconciliationAuthorized(request, secret))
          return new Response("Unauthorized", { status: 401 });
        if (!hasSupabaseAdminConfig()) return new Response("Not configured", { status: 503 });
        try {
          return Response.json(await processEmailOutbox(getSupabaseAdmin(), emailConfig()));
        } catch {
          console.error("Transactional email worker failed");
          return new Response("Email worker failed", { status: 503 });
        }
      },
    },
  },
});
