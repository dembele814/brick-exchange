import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import {
  connectAccountCreateParams,
  connectAccountIdFor,
  connectMetadataKey,
  connectState,
  createDeliveredTransfer,
} from "@/server/connect";
import { paymentConfig } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";
import { enforceRateLimit, RateLimitExceededError } from "@/server/rate-limit";

const payoutInput = z.object({ orderId: z.string().uuid() });

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token || !hasSupabaseAdminConfig()) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

function stripeClient() {
  const config = paymentConfig(process.env);
  return { stripe: new Stripe(config.key), appUrl: config.appUrl, liveMode: config.liveMode };
}

export const Route = createFileRoute("/api/connect")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await authenticatedUser(request);
        if (!user)
          return Response.json({ error: "Zaloguj się, aby sprawdzić wypłaty." }, { status: 401 });
        try {
          const { stripe, liveMode } = stripeClient();
          const accountId = connectAccountIdFor(user, liveMode);
          if (typeof accountId !== "string")
            return Response.json({ state: "missing", livemode: liveMode });
          const account = await stripe.v2.core.accounts.retrieve(accountId, {
            include: ["configuration.recipient", "requirements"],
          });
          const state = connectState(account);
          const transfers: Record<string, { amount: number; fee: number }> = {};
          if (state.state === "active") {
            const { data: deliveredOrders, error: ordersError } = await getSupabaseAdmin()
              .from("orders")
              .select("id")
              .eq("seller_id", user.id)
              .eq("status", "delivered")
              .eq("stripe_livemode", liveMode)
              .order("created_at", { ascending: false })
              .limit(5);
            if (ordersError) throw ordersError;
            await Promise.all(
              (deliveredOrders ?? []).map(async (order) => {
                const result = await stripe.transfers.list({
                  transfer_group: `order_${order.id}`,
                  limit: 1,
                });
                const transfer = result.data.find((item) => !item.reversed);
                if (transfer)
                  transfers[order.id] = {
                    amount: transfer.amount,
                    fee: Number(transfer.metadata["platform_fee_grosz"] ?? 0),
                  };
              }),
            );
          }
          return Response.json({ ...state, transfers, livemode: liveMode });
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
          await enforceRateLimit(getSupabaseAdmin(), "connect-onboarding", user.id, 10, 300);
        } catch (cause) {
          return Response.json(
            {
              error:
                cause instanceof RateLimitExceededError
                  ? cause.message
                  : "Weryfikacja wypłat jest chwilowo niedostępna.",
            },
            { status: cause instanceof RateLimitExceededError ? 429 : 503 },
          );
        }
        try {
          const { stripe, appUrl, liveMode } = stripeClient();
          let accountId = connectAccountIdFor(user, liveMode);
          if (typeof accountId !== "string") {
            const account = await stripe.v2.core.accounts.create(
              connectAccountCreateParams(user.id, user.email, appUrl),
              { idempotencyKey: `klockownia-connect:${liveMode ? "live" : "test"}:${user.id}:v1` },
            );
            accountId = account.id;
            const { error } = await getSupabaseAdmin().auth.admin.updateUserById(user.id, {
              app_metadata: {
                ...user.app_metadata,
                [connectMetadataKey(liveMode)]: accountId,
              },
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
      PATCH: async ({ request }) => {
        const user = await authenticatedUser(request);
        if (!user)
          return Response.json({ error: "Zaloguj się, aby uruchomić transfer." }, { status: 401 });
        try {
          await enforceRateLimit(getSupabaseAdmin(), "connect-transfer", user.id, 10, 60);
        } catch (cause) {
          return Response.json(
            {
              error:
                cause instanceof RateLimitExceededError
                  ? cause.message
                  : "Transfery są chwilowo niedostępne.",
            },
            { status: cause instanceof RateLimitExceededError ? 429 : 503 },
          );
        }
        const parsed = payoutInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: "Nieprawidłowe zamówienie." }, { status: 400 });

        const admin = getSupabaseAdmin();
        const { data: order, error: orderError } = await admin
          .from("orders")
          .select(
            "id,seller_id,amount_grosz,status,payment_status,stripe_payment_intent_id,stripe_livemode",
          )
          .eq("id", parsed.data.orderId)
          .maybeSingle();
        if (orderError || !order)
          return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
        if (order.seller_id !== user.id)
          return Response.json({ error: "Tylko sprzedawca może odebrać środki." }, { status: 403 });
        if (order.status !== "delivered" || order.payment_status !== "paid")
          return Response.json(
            { error: "Transfer jest dostępny po opłaceniu i potwierdzeniu odbioru." },
            { status: 409 },
          );
        const config = paymentConfig(process.env);
        if (order.stripe_livemode !== config.liveMode)
          return Response.json(
            { error: "To zamówienie pochodzi z innego trybu Stripe." },
            { status: 409 },
          );
        const accountId = connectAccountIdFor(user, config.liveMode);
        if (typeof accountId !== "string")
          return Response.json(
            { error: "Najpierw skonfiguruj konto Stripe Connect." },
            { status: 409 },
          );
        if (typeof order.stripe_payment_intent_id !== "string")
          return Response.json(
            { error: "Brakuje potwierdzenia płatności Stripe." },
            { status: 409 },
          );

        try {
          const { stripe, liveMode } = stripeClient();
          const result = await createDeliveredTransfer(stripe, accountId, order, liveMode);
          if (result.state === "not_ready")
            return Response.json(
              { error: "Dokończ weryfikację Stripe przed transferem." },
              { status: 409 },
            );
          if (result.state === "transferred")
            await admin
              .from("orders")
              .update({
                seller_transfer_id: result.transferId,
                seller_transfer_status: "paid",
                seller_transferred_at: new Date().toISOString(),
              })
              .eq("id", order.id)
              .is("seller_transfer_id", null);
          return Response.json(result);
        } catch {
          console.error("Stripe Connect transfer requires retry or investigation", order.id);
          return Response.json(
            { error: "Nie udało się wykonać transferu. Spróbuj ponownie później." },
            { status: 503 },
          );
        }
      },
    },
  },
});
