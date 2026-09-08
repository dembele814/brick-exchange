import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import { createDeliveredTransfer } from "@/server/connect";
import { paymentConfig } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const fulfillmentInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("mark_shipped"),
  trackingNumber: z.string().trim().min(3).max(100),
});
const deliveryInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("confirm_delivered"),
});
const orderActionInput = z.discriminatedUnion("action", [fulfillmentInput, deliveryInput]);

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

export const Route = createFileRoute("/api/orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!hasSupabaseAdminConfig())
          return Response.json(
            { error: "Zamówienia nie są jeszcze skonfigurowane." },
            { status: 503 },
          );
        const user = await authenticatedUser(request);
        if (!user)
          return Response.json({ error: "Zaloguj się, aby zobaczyć zamówienia." }, { status: 401 });
        const { data, error } = await getSupabaseAdmin()
          .from("orders")
          .select(
            "id,buyer_id,seller_id,amount_grosz,status,shipping_carrier,locker_id,tracking_number,created_at,listings(title,listing_images(storage_path,position)),buyer:profiles!orders_buyer_id_fkey(username),seller:profiles!orders_seller_id_fkey(username)",
          )
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order("created_at", { ascending: false });
        if (error)
          return Response.json({ error: "Nie udało się pobrać zamówień." }, { status: 500 });
        return Response.json(data ?? []);
      },
      PATCH: async ({ request }) => {
        if (!hasSupabaseAdminConfig())
          return Response.json(
            { error: "Obsługa wysyłek nie jest jeszcze skonfigurowana." },
            { status: 503 },
          );
        const user = await authenticatedUser(request);
        if (!user)
          return Response.json(
            { error: "Zaloguj się, aby zarządzać zamówieniem." },
            { status: 401 },
          );
        const body = await request.json();
        const parsed = orderActionInput.safeParse(body);
        if (!parsed.success)
          return Response.json({ error: "Nieprawidłowe dane przesyłki." }, { status: 400 });
        const action = parsed.data;
        const admin = getSupabaseAdmin();
        const { data: order, error: orderError } = await admin
          .from("orders")
          .select(
            "id,seller_id,buyer_id,amount_grosz,status,payment_status,stripe_payment_intent_id",
          )
          .eq("id", action.orderId)
          .maybeSingle();
        if (orderError || !order)
          return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
        if (action.action === "confirm_delivered") {
          if (order.buyer_id !== user.id)
            return Response.json(
              { error: "Tylko kupujący może potwierdzić odbiór." },
              { status: 403 },
            );
          if (order.status !== "shipped")
            return Response.json(
              { error: "Odbiór można potwierdzić po nadaniu przesyłki." },
              { status: 409 },
            );
          const { error: deliveredError } = await admin
            .from("orders")
            .update({ status: "delivered", delivered_at: new Date().toISOString() })
            .eq("id", order.id)
            .eq("status", "shipped");
          if (deliveredError)
            return Response.json({ error: "Nie udało się potwierdzić odbioru." }, { status: 500 });
          await admin.from("order_events").insert({
            order_id: order.id,
            actor_id: user.id,
            event_type: "delivery_confirmed",
            payload: {},
          });
          let notificationBody = "Kupujący potwierdził odbiór zamówienia.";
          try {
            const { data: sellerAuth } = await admin.auth.admin.getUserById(order.seller_id);
            const accountId = sellerAuth.user?.app_metadata?.["klockownia_stripe_account_id"];
            if (typeof accountId === "string") {
              const config = paymentConfig(process.env);
              const transfer = await createDeliveredTransfer(new Stripe(config.key), accountId, {
                ...order,
                status: "delivered",
              });
              if (transfer.state === "transferred")
                notificationBody += ` Transfer testowy ${new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(transfer.amount / 100)} został utworzony.`;
              else if (transfer.state === "not_ready")
                notificationBody += " Dokończ weryfikację Stripe, aby otrzymać transfer testowy.";
            } else {
              notificationBody += " Skonfiguruj Stripe Connect, aby otrzymać transfer testowy.";
            }
          } catch {
            console.error("Automatic test transfer requires retry", order.id);
            notificationBody += " Transfer testowy oczekuje na ponowną próbę w panelu sprzedaży.";
          }
          await admin.from("notifications").insert({
            user_id: order.seller_id,
            kind: "delivery",
            title: "Odbiór przesyłki potwierdzony",
            body: notificationBody,
            href: `/portfel`,
          });
          return Response.json({ ok: true });
        }
        if (order.seller_id !== user.id)
          return Response.json(
            { error: "Tylko sprzedawca może nadać tę przesyłkę." },
            { status: 403 },
          );
        if (order.status !== "paid")
          return Response.json(
            { error: "Przesyłkę można nadać dopiero po opłaceniu zamówienia." },
            { status: 409 },
          );
        const { error: updateError } = await admin
          .from("orders")
          .update({
            status: "shipped",
            tracking_number: action.trackingNumber,
            shipped_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .eq("status", "paid");
        if (updateError)
          return Response.json({ error: "Nie udało się zapisać nadania." }, { status: 500 });
        await admin.from("order_events").insert({
          order_id: order.id,
          actor_id: user.id,
          event_type: "shipment_marked_shipped",
          payload: { tracking_number: action.trackingNumber },
        });
        await admin.from("notifications").insert({
          user_id: order.buyer_id,
          kind: "shipment",
          title: "Przesyłka została nadana",
          body: `Sprzedawca dodał numer śledzenia: ${action.trackingNumber}.`,
          href: `/zamowienia?order=${order.id}`,
        });
        return Response.json({ ok: true });
      },
    },
  },
});
