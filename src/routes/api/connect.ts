import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import {
  connectAccountCreateParams,
  connectFeeGrosz,
  connectState,
  sellerProceedsGrosz,
} from "@/server/connect";
import { paymentConfig } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const metadataKey = "klockownia_stripe_account_id";
const payoutInput = z.object({ orderId: z.string().uuid() });

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
      PATCH: async ({ request }) => {
        const user = await authenticatedUser(request);
        if (!user)
          return Response.json({ error: "Zaloguj się, aby uruchomić transfer." }, { status: 401 });
        const parsed = payoutInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: "Nieprawidłowe zamówienie." }, { status: 400 });

        const admin = getSupabaseAdmin();
        const { data: order, error: orderError } = await admin
          .from("orders")
          .select("id,seller_id,amount_grosz,status,payment_status,stripe_payment_intent_id")
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
        const accountId = user.app_metadata?.[metadataKey];
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
          const { stripe } = stripeClient();
          const account = await stripe.v2.core.accounts.retrieve(accountId, {
            include: ["configuration.recipient"],
          });
          if (connectState(account).state !== "active")
            return Response.json(
              { error: "Dokończ weryfikację Stripe przed transferem." },
              { status: 409 },
            );
          const paymentIntent = await stripe.paymentIntents.retrieve(
            order.stripe_payment_intent_id,
            { expand: ["latest_charge"] },
          );
          if (
            paymentIntent.livemode ||
            paymentIntent.status !== "succeeded" ||
            paymentIntent.metadata["order_id"] !== order.id
          )
            throw new Error("Payment does not match the order");
          const latestCharge = paymentIntent.latest_charge;
          const chargeId =
            typeof latestCharge === "string" ? latestCharge : (latestCharge?.id ?? null);
          if (!chargeId) throw new Error("Payment charge is missing");

          const expectedFee = connectFeeGrosz(order.amount_grosz);
          const storedFee = Number(paymentIntent.metadata["platform_fee_grosz"] ?? expectedFee);
          if (!Number.isSafeInteger(storedFee) || storedFee !== expectedFee)
            throw new Error("Fee snapshot does not match policy");
          const amount = sellerProceedsGrosz(order.amount_grosz);
          if (amount <= 0)
            return Response.json({ state: "no_transfer", amount: 0, fee: expectedFee });

          await stripe.transfers.create(
            {
              amount,
              currency: "pln",
              destination: accountId,
              source_transaction: chargeId,
              transfer_group: paymentIntent.transfer_group ?? `order_${order.id}`,
              metadata: {
                order_id: order.id,
                platform_fee_grosz: String(expectedFee),
                integration: "klockownia_connect_v1",
              },
            },
            { idempotencyKey: `klockownia-transfer:${order.id}:v1` },
          );
          return Response.json({ state: "transferred", amount, fee: expectedFee });
        } catch {
          console.error("Stripe Connect transfer requires retry or investigation", order.id);
          return Response.json(
            { error: "Nie udało się wykonać transferu testowego. Spróbuj ponownie później." },
            { status: 503 },
          );
        }
      },
    },
  },
});
