import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const fulfillmentInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("mark_shipped"),
  trackingNumber: z.string().trim().min(3).max(100),
});
const deliveryInput = z.object({ orderId: z.string().uuid(), action: z.literal("confirm_delivered") });
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
      PATCH: async ({ request }) => {
        if (!hasSupabaseAdminConfig()) return Response.json({ error: "Obsługa wysyłek nie jest jeszcze skonfigurowana." }, { status: 503 });
        const user = await authenticatedUser(request);
        if (!user) return Response.json({ error: "Zaloguj się, aby zarządzać zamówieniem." }, { status: 401 });
        const body = await request.json();
        const parsed = orderActionInput.safeParse(body);
        if (!parsed.success) return Response.json({ error: "Nieprawidłowe dane przesyłki." }, { status: 400 });
        const action = parsed.data;
        const admin = getSupabaseAdmin();
        const { data: order, error: orderError } = await admin.from("orders")
          .select("id,seller_id,buyer_id,status")
          .eq("id", action.orderId)
          .maybeSingle();
        if (orderError || !order) return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
        if (action.action === "confirm_delivered") {
          if (order.buyer_id !== user.id) return Response.json({ error: "Tylko kupujący może potwierdzić odbiór." }, { status: 403 });
          if (order.status !== "shipped") return Response.json({ error: "Odbiór można potwierdzić po nadaniu przesyłki." }, { status: 409 });
          const { error: deliveredError } = await admin.from("orders").update({ status: "delivered", delivered_at: new Date().toISOString() }).eq("id", order.id).eq("status", "shipped");
          if (deliveredError) return Response.json({ error: "Nie udało się potwierdzić odbioru." }, { status: 500 });
          await admin.from("order_events").insert({ order_id: order.id, actor_id: user.id, event_type: "delivery_confirmed", payload: {} });
          await admin.from("notifications").insert({ user_id: order.seller_id, kind: "delivery", title: "Odbiór przesyłki potwierdzony", body: "Kupujący potwierdził odbiór zamówienia.", href: `/zamowienia?order=${order.id}` });
          return Response.json({ ok: true });
        }
        if (order.seller_id !== user.id) return Response.json({ error: "Tylko sprzedawca może nadać tę przesyłkę." }, { status: 403 });
        if (order.status !== "paid") return Response.json({ error: "Przesyłkę można nadać dopiero po opłaceniu zamówienia." }, { status: 409 });
        const { error: updateError } = await admin.from("orders").update({
          status: "shipped", tracking_number: action.trackingNumber, shipped_at: new Date().toISOString(),
        }).eq("id", order.id).eq("status", "paid");
        if (updateError) return Response.json({ error: "Nie udało się zapisać nadania." }, { status: 500 });
        await admin.from("order_events").insert({ order_id: order.id, actor_id: user.id, event_type: "shipment_marked_shipped", payload: { tracking_number: action.trackingNumber } });
        await admin.from("notifications").insert({ user_id: order.buyer_id, kind: "shipment", title: "Przesyłka została nadana", body: `Sprzedawca dodał numer śledzenia: ${action.trackingNumber}.`, href: `/zamowienia?order=${order.id}` });
        return Response.json({ ok: true });
      },
    },
  },
});
