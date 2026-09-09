import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import { paymentConfig, refundPayment } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const adminAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close_problem"), orderId: z.string().uuid() }),
  z.object({ action: z.literal("hide_listing"), reportId: z.string().uuid() }),
  z.object({ action: z.literal("refund_order"), orderId: z.string().uuid() }),
]);

async function adminUser(request: Request) {
  if (!hasSupabaseAdminConfig()) return null;
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  if (error || data.user?.app_metadata?.["klockownia_admin"] !== true) return null;
  return data.user;
}

export const Route = createFileRoute("/api/admin")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await adminUser(request);
        if (!user) return Response.json({ error: "Brak dostępu administratora." }, { status: 403 });
        const db = getSupabaseAdmin();
        const [events, reports] = await Promise.all([
          db
            .from("order_events")
            .select(
              "id,order_id,event_type,payload,created_at,orders(id,status,payment_status,amount_grosz,buyer:profiles!orders_buyer_id_fkey(username),seller:profiles!orders_seller_id_fkey(username))",
            )
            .in("event_type", ["problem_reported", "problem_resolved"])
            .order("id", { ascending: false }),
          db
            .from("listing_reports")
            .select(
              "id,reason,details,created_at,listings(id,title,status,profiles!listings_seller_id_fkey(username))",
            )
            .order("created_at", { ascending: false })
            .limit(100),
        ]);
        if (events.error || reports.error)
          return Response.json({ error: "Nie udało się pobrać panelu." }, { status: 500 });
        const latest = new Map<string, (typeof events.data)[number]>();
        for (const event of events.data ?? [])
          if (!latest.has(event.order_id)) latest.set(event.order_id, event);
        return Response.json({
          problems: [...latest.values()].filter((event) => event.event_type === "problem_reported"),
          reports: reports.data ?? [],
        });
      },
      PATCH: async ({ request }) => {
        const user = await adminUser(request);
        if (!user) return Response.json({ error: "Brak dostępu administratora." }, { status: 403 });
        const parsed = adminAction.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: "Nieprawidłowa operacja." }, { status: 400 });
        const db = getSupabaseAdmin();
        const input = parsed.data;

        if (input.action === "hide_listing") {
          const report = await db
            .from("listing_reports")
            .select("listing_id,listings(seller_id)")
            .eq("id", input.reportId)
            .maybeSingle();
          if (report.error || !report.data)
            return Response.json({ error: "Nie znaleziono zgłoszenia." }, { status: 404 });
          const listing = Array.isArray(report.data.listings)
            ? report.data.listings[0]
            : report.data.listings;
          const hidden = await db
            .from("listings")
            .update({ status: "hidden" })
            .eq("id", report.data.listing_id)
            .in("status", ["active", "hidden"]);
          if (hidden.error)
            return Response.json({ error: "Nie udało się ukryć oferty." }, { status: 500 });
          if (listing?.seller_id)
            await db.from("notifications").insert({
              user_id: listing.seller_id,
              kind: "system",
              title: "Oferta została ukryta",
              body: "Administrator ukrył ofertę po otrzymanym zgłoszeniu. Sprawdź opis i zdjęcia przed ponowną publikacją.",
              href: "/profil",
            });
          return Response.json({ ok: true });
        }

        const order = await db
          .from("orders")
          .select(
            "id,listing_id,buyer_id,seller_id,status,payment_status,stripe_payment_intent_id,stripe_livemode",
          )
          .eq("id", input.orderId)
          .maybeSingle();
        if (order.error || !order.data)
          return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });

        if (input.action === "close_problem") {
          await db.from("order_events").insert({
            order_id: order.data.id,
            actor_id: user.id,
            event_type: "problem_resolved",
            payload: { resolved_by: "admin" },
          });
          await db.from("notifications").insert([
            {
              user_id: order.data.buyer_id,
              kind: "system",
              title: "Zgłoszenie zostało zamknięte",
              body: "Administrator zakończył obsługę problemu z zamówieniem.",
              href: `/zamowienia?order=${order.data.id}`,
            },
            {
              user_id: order.data.seller_id,
              kind: "system",
              title: "Zgłoszenie zostało zamknięte",
              body: "Administrator zakończył obsługę problemu z zamówieniem.",
              href: `/zamowienia?order=${order.data.id}`,
            },
          ]);
          return Response.json({ ok: true });
        }

        if (
          order.data.payment_status !== "paid" ||
          !["shipped", "delivered"].includes(order.data.status)
        )
          return Response.json({ error: "Tego zamówienia nie można zwrócić." }, { status: 409 });
        try {
          const config = paymentConfig(process.env);
          if (order.data.stripe_livemode !== config.liveMode)
            return Response.json(
              { error: "Zamówienie pochodzi z innego trybu Stripe." },
              { status: 409 },
            );
          const stripe = new Stripe(config.key);
          const transfers = await stripe.transfers.list({
            transfer_group: `order_${order.data.id}`,
            limit: 10,
          });
          for (const transfer of transfers.data.filter((item) => !item.reversed))
            await stripe.transfers.createReversal(
              transfer.id,
              {
                amount: transfer.amount - transfer.amount_reversed,
                metadata: { order_id: order.data.id },
              },
              { idempotencyKey: `klockownia-reversal:${order.data.id}:${transfer.id}:v1` },
            );
          const refund = await refundPayment(stripe, order.data, config.liveMode);
          if (refund.status !== "succeeded")
            return Response.json(
              { error: "Zwrot Stripe nadal jest przetwarzany." },
              { status: 409 },
            );
          await db.from("listings").update({ status: "active" }).eq("id", order.data.listing_id);
          const updated = await db
            .from("orders")
            .update({ status: "cancelled", payment_status: "refunded" })
            .eq("id", order.data.id)
            .eq("payment_status", "paid");
          if (updated.error) throw updated.error;
          await db.from("order_events").insert({
            order_id: order.data.id,
            actor_id: user.id,
            event_type: "payment_refunded",
            payload: { stripe_refund_id: refund.id, resolved_by: "admin" },
          });
          await db.from("notifications").insert([
            {
              user_id: order.data.buyer_id,
              kind: "payment",
              title: "Płatność została zwrócona",
              body: "Administrator zatwierdził pełny zwrot płatności.",
              href: `/zamowienia?order=${order.data.id}`,
            },
            {
              user_id: order.data.seller_id,
              kind: "payment",
              title: "Zamówienie zostało zwrócone",
              body: "Administrator zatwierdził zwrot; transfer został cofnięty.",
              href: `/zamowienia?order=${order.data.id}`,
            },
          ]);
          return Response.json({ ok: true });
        } catch {
          console.error("Admin refund requires investigation", order.data.id);
          return Response.json({ error: "Nie udało się zakończyć zwrotu." }, { status: 503 });
        }
      },
    },
  },
});
