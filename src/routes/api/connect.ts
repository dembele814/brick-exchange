import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { connectAccountCreateParams, connectState } from "@/server/connect";
import { paymentConfig } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const metadataKey = "klockownia_stripe_account_id";

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || !hasSupabaseAdminConfig()) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

function stripeClient() {
  const config = paymentConfig(process.env);
  return { stripe: new Stripe(config.key), appUrl: config.appUrl };
}

export const Route = createFileRoute("/api/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await authenticatedUser(request);
        if (!user)
          return Response.json({ error: "Zaloguj się, aby sprawdzić wypłaty." }, { status: 401 });
        const accountId = user.app_metadata?.[metadataKey];
        if (typeof accountId !== "string") return Response.json({ state: "missing" });
        try {
          const { stripe } = stripeClient();
          const account = await stripe.v2.core.accounts.retrieve(accountId, {
            include: ["configuration.recipient", "requirements"],
          });
          return Response.json(connectState(account));
        } catch {
          return Response.json(
            { error: "Nie udało się sprawdzić statusu konta Stripe." },
            { status: 503 },
          );
        }
      },
      POST: async ({ request }) => {
        const user = await authenticatedUser(request);
        if (!user?.email)
          return Response.json(
            { error: "Zaloguj się, aby skonfigurować wypłaty." },
            { status: 401 },
          );
        try {
          const { stripe, appUrl } = stripeClient();
          let accountId = user.app_metadata?.[metadataKey];
          if (typeof accountId !== "string") {
            const account = await stripe.v2.core.accounts.create(
              connectAccountCreateParams(user.id, user.email, appUrl),
              { idempotencyKey: `klockownia-connect:${user.id}:v1` },
            );
            accountId = account.id;
            const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
              app_metadata: { ...user.app_metadata, [metadataKey]: accountId },
            });
            if (error) throw error;
          }
          const link = await stripe.v2.core.accountLinks.create({
            account: accountId,
            use_case: {
              type: "account_onboarding",
              account_onboarding: {
                configurations: ["recipient"],
                collection_options: { fields: "eventually_due", future_requirements: "include" },
                refresh_url: `${appUrl}/portfel`,
                return_url: `${appUrl}/portfel`,
              },
            },
          });
          return Response.json({ onboardingUrl: link.url });
        } catch {
          console.error("Stripe Connect onboarding could not be started");
          return Response.json(
            { error: "Nie udało się rozpocząć weryfikacji Stripe. Spróbuj ponownie później." },
            { status: 503 },
          );
        }
      },
    },
  },
});
