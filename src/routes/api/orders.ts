import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";
import { z } from "zod";
import { createDeliveredTransfer } from "@/server/connect";
import { paymentConfig, refundPayment } from "@/server/payments";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";
import {
  createInpostShipment,
  getInpostLabel,
  getInpostShipment,
  inpostConfig,
} from "@/server/inpost";

const fulfillmentInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("mark_shipped"),
  trackingNumber: z.string().trim().min(3).max(100),
});
const deliveryInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("confirm_delivered"),
});
const cancellationInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("cancel_before_shipment"),
});
const problemInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("report_problem"),
  reason: z.enum(["damaged", "incomplete", "not_as_described", "not_received", "other"]),
  details: z.string().trim().min(10).max(1000),
});
const resolveProblemInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("resolve_problem"),
});
const conversationInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("start_conversation"),
});
const createShipmentInput = z.object({
  orderId: z.string().uuid(),
  action: z.literal("create_inpost_shipment"),
});
const orderActionInput = z.discriminatedUnion("action", [
  fulfillmentInput,
  deliveryInput,
  cancellationInput,
  problemInput,
  resolveProblemInput,
  conversationInput,
  createShipmentInput,
]);

async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await getSupabaseAdmin().auth.getUser(token);
  return error ? null : data.user;
}

async function hasOpenProblem(orderId: string) {
  const { data, error } = await getSupabaseAdmin()
    .from("order_events")
    .select("event_type")
    .eq("order_id", orderId)
    .in("event_type", ["problem_reported", "problem_resolved"])
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.event_type === "problem_reported";
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
        const url = new URL(request.url);
        const labelOrderId = url.searchParams.get("label");
        if (labelOrderId) {
          if (!z.string().uuid().safeParse(labelOrderId).success)
            return Response.json({ error: "Nieprawidłowe zamówienie." }, { status: 400 });
          const admin = getSupabaseAdmin();
          const { data: order, error: labelOrderError } = await admin
            .from("orders")
            .select("id,seller_id,shipping_carrier,carrier_shipment_id,shipping_livemode")
            .eq("id", labelOrderId)
            .maybeSingle();
          if (labelOrderError || !order)
            return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
          if (order.seller_id !== user.id)
            return Response.json({ error: "Tylko sprzedawca może pobrać etykietę." }, { status: 403 });
          if (order.shipping_carrier !== "inpost" || !order.carrier_shipment_id)
            return Response.json({ error: "Etykieta nie jest jeszcze gotowa." }, { status: 409 });
          try {
            const config = inpostConfig();
            if (config.liveMode !== order.shipping_livemode)
              return Response.json({ error: "Tryb wysyłki nie zgadza się z etykietą." }, { status: 409 });
            const label = await getInpostLabel(order.carrier_shipment_id, config);
            return new Response(label.body, {
              status: 200,
              headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="etykieta-${order.id}.pdf"`,
                "Cache-Control": "private, no-store",
              },
            });
          } catch {
            return Response.json({ error: "Nie udało się pobrać etykiety InPost." }, { status: 503 });
          }
        }
        const { data, error } = await getSupabaseAdmin()
          .from("orders")
          .select(
            "id,buyer_id,seller_id,amount_grosz,status,payment_status,shipping_carrier,locker_id,tracking_number,carrier_shipment_id,carrier_status,shipping_label_ready_at,created_at,listings(title,listing_images(storage_path,position)),buyer:profiles!orders_buyer_id_fkey(username),seller:profiles!orders_seller_id_fkey(username)",
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
            "id,listing_id,seller_id,buyer_id,amount_grosz,status,payment_status,stripe_payment_intent_id,stripe_livemode,shipping_carrier,locker_id,receiver_email,receiver_phone,receiver_first_name,receiver_last_name,parcel_template,carrier_shipment_id,shipping_creation_started_at,shipping_livemode",
          )
          .eq("id", action.orderId)
          .maybeSingle();
        if (orderError || !order)
          return Response.json({ error: "Nie znaleziono zamówienia." }, { status: 404 });
        if (action.action === "create_inpost_shipment") {
          if (order.seller_id !== user.id)
            return Response.json({ error: "Tylko sprzedawca może utworzyć przesyłkę." }, { status: 403 });
          if (order.status !== "paid" || order.payment_status !== "paid")
            return Response.json({ error: "Etykietę można utworzyć po opłaceniu zamówienia." }, { status: 409 });
          if (order.shipping_carrier !== "inpost")
            return Response.json({ error: "Automatyczne etykiety są teraz dostępne dla InPost." }, { status: 409 });
          if (order.carrier_shipment_id) {
            try {
              const config = inpostConfig();
              if (config.liveMode !== order.shipping_livemode)
                return Response.json({ error: "Tryb wysyłki nie zgadza się z przesyłką." }, { status: 409 });
              const shipment = await getInpostShipment(order.carrier_shipment_id, config);
              const trackingNumber =
                typeof shipment.tracking_number === "string" ? shipment.tracking_number : null;
              const now = new Date().toISOString();
              await admin
                .from("orders")
                .update({
                  tracking_number: trackingNumber,
                  carrier_status:
                    typeof shipment.status === "string" ? shipment.status : "created",
                  carrier_status_updated_at: now,
                  shipping_label_ready_at: trackingNumber ? now : null,
                })
                .eq("id", order.id);
              return Response.json({ ok: true, labelReady: Boolean(trackingNumber) });
            } catch {
              return Response.json({ error: "InPost jeszcze przygotowuje przesyłkę." }, { status: 503 });
            }
          }
          const staleBefore = new Date(Date.now() - 2 * 60_000).toISOString();
          const { data: claimed, error: claimError } = await admin
            .from("orders")
            .update({ shipping_creation_started_at: new Date().toISOString() })
            .eq("id", order.id)
            .is("carrier_shipment_id", null)
            .or(`shipping_creation_started_at.is.null,shipping_creation_started_at.lt.${staleBefore}`)
            .select("id")
            .maybeSingle();
          if (claimError || !claimed)
            return Response.json({ error: "Etykieta jest już tworzona. Odśwież za chwilę." }, { status: 409 });
          try {
            const config = inpostConfig();
            const shipment = await createInpostShipment(
              {
                receiver: {
                  email: order.receiver_email,
                  phone: order.receiver_phone,
                  firstName: order.receiver_first_name,
                  lastName: order.receiver_last_name,
                },
                parcelLockerId: order.locker_id,
                parcelTemplate: order.parcel_template,
                reference: order.id,
              },
              config,
            );
            const now = new Date().toISOString();
            const { error: saveError } = await admin
              .from("orders")
              .update({
                carrier_shipment_id: shipment.id,
                tracking_number: shipment.trackingNumber,
                carrier_status: shipment.status,
                carrier_status_updated_at: now,
                shipping_label_ready_at: shipment.trackingNumber ? now : null,
                shipping_livemode: config.liveMode,
                shipping_creation_started_at: null,
              })
              .eq("id", order.id)
              .is("carrier_shipment_id", null);
            if (saveError) throw saveError;
            await admin.from("order_events").insert({
              order_id: order.id,
              actor_id: user.id,
              event_type: "shipping_label_created",
              payload: { provider: "inpost", tracking_number: shipment.trackingNumber },
            });
            return Response.json({ ok: true, labelReady: Boolean(shipment.trackingNumber) });
          } catch (cause) {
            await admin
              .from("orders")
              .update({ shipping_creation_started_at: null })
              .eq("id", order.id)
              .is("carrier_shipment_id", null);
            const message = cause instanceof Error ? cause.message : "Nie udało się utworzyć przesyłki.";
            return Response.json({ error: message }, { status: 503 });
          }
        }
        if (action.action === "start_conversation") {
          if (order.buyer_id !== user.id && order.seller_id !== user.id)
            return Response.json(
              { error: "Nie masz dostępu do rozmowy o tym zamówieniu." },
              { status: 403 },
            );
          const existing = await admin
            .from("conversations")
            .select("id")
            .eq("listing_id", order.listing_id)
            .eq("buyer_id", order.buyer_id)
            .maybeSingle();
          if (existing.error) throw existing.error;
          let conversationId = existing.data?.id;
          if (!conversationId) {
            const created = await admin
              .from("conversations")
              .insert({ listing_id: order.listing_id, buyer_id: order.buyer_id })
              .select("id")
              .single();
            if (created.error) {
              const raced = await admin
                .from("conversations")
                .select("id")
                .eq("listing_id", order.listing_id)
                .eq("buyer_id", order.buyer_id)
                .single();
              if (raced.error) throw created.error;
              conversationId = raced.data.id;
            } else conversationId = created.data.id;
          }
          const { error: participantsError } = await admin.from("conversation_participants").upsert(
            [
              { conversation_id: conversationId, user_id: order.buyer_id },
              { conversation_id: conversationId, user_id: order.seller_id },
            ],
            { onConflict: "conversation_id,user_id", ignoreDuplicates: true },
          );
          if (participantsError) throw participantsError;
          return Response.json({ conversationId });
        }
        if (action.action === "report_problem" || action.action === "resolve_problem") {
          if (order.buyer_id !== user.id)
            return Response.json(
              { error: "Tylko kupujący może zarządzać zgłoszeniem problemu." },
              { status: 403 },
            );
          if (order.status !== "shipped")
            return Response.json(
              { error: "Problem z przesyłką można zgłosić przed potwierdzeniem odbioru." },
              { status: 409 },
            );
          const problemOpen = await hasOpenProblem(order.id);
          if (action.action === "report_problem" && problemOpen)
            return Response.json({ error: "Problem jest już zgłoszony." }, { status: 409 });
          if (action.action === "resolve_problem" && !problemOpen)
            return Response.json({ error: "Brak otwartego zgłoszenia." }, { status: 409 });

          const reported = action.action === "report_problem";
          const { error: eventError } = await admin.from("order_events").insert({
            order_id: order.id,
            actor_id: user.id,
            event_type: reported ? "problem_reported" : "problem_resolved",
            payload: reported ? { reason: action.reason, details: action.details } : {},
          });
          if (eventError)
            return Response.json({ error: "Nie udało się zapisać zgłoszenia." }, { status: 500 });
          await admin.from("notifications").insert({
            user_id: order.seller_id,
            kind: "system",
            title: reported ? "Kupujący zgłosił problem" : "Problem został rozwiązany",
            body: reported
              ? `Kupujący wstrzymał potwierdzenie odbioru: ${action.details.slice(0, 350)}`
              : "Kupujący oznaczył problem jako rozwiązany. Może teraz potwierdzić odbiór.",
            href: `/zamowienia?order=${order.id}`,
          });
          return Response.json({ ok: true });
        }
        if (action.action === "cancel_before_shipment") {
          if (order.buyer_id !== user.id)
            return Response.json(
              { error: "Tylko kupujący może anulować zamówienie." },
              { status: 403 },
            );
          if (
            (order.status !== "paid" && order.status !== "cancelled") ||
            order.payment_status !== "paid"
          )
            return Response.json(
              { error: "Można anulować tylko opłacone zamówienie przed wysyłką." },
              { status: 409 },
            );

          if (order.status === "paid") {
            const { data: claimed, error: claimError } = await admin
              .from("orders")
              .update({ status: "cancelled" })
              .eq("id", order.id)
              .eq("status", "paid")
              .eq("payment_status", "paid")
              .select("id")
              .maybeSingle();
            if (claimError || !claimed)
              return Response.json(
                { error: "Status zamówienia zmienił się. Odśwież stronę." },
                { status: 409 },
              );
          }

          let refund: Awaited<ReturnType<typeof refundPayment>>;
          try {
            const config = paymentConfig(process.env);
            if (order.stripe_livemode !== config.liveMode) throw new Error("Stripe mode mismatch");
            refund = await refundPayment(new Stripe(config.key), order, config.liveMode);
          } catch {
            console.error("Refund outcome requires reconciliation", order.id);
            return Response.json(
              { error: "Zwrot jest sprawdzany. Użyj przycisku ponownie za chwilę." },
              { status: 503 },
            );
          }
          if (refund.status === "failed" || refund.status === "canceled") {
            await admin
              .from("orders")
              .update({ status: "paid" })
              .eq("id", order.id)
              .eq("status", "cancelled")
              .eq("payment_status", "paid");
            return Response.json(
              { error: "Stripe odrzucił zwrot płatności. Spróbuj ponownie." },
              { status: 503 },
            );
          }
          if (refund.status !== "succeeded")
            return Response.json({ ok: true, pending: true }, { status: 202 });

          try {
            const { error: listingUpdateError } = await admin
              .from("listings")
              .update({ status: "active" })
              .eq("id", order.listing_id);
            if (listingUpdateError) throw listingUpdateError;
            const { data: reconciled, error: refundUpdateError } = await admin
              .from("orders")
              .update({ status: "cancelled", payment_status: "refunded" })
              .eq("id", order.id)
              .eq("status", "cancelled")
              .eq("payment_status", "paid")
              .select("id")
              .maybeSingle();
            if (refundUpdateError) throw refundUpdateError;
            if (!reconciled) return Response.json({ ok: true });
            const { error: eventError } = await admin.from("order_events").insert({
              order_id: order.id,
              actor_id: user.id,
              event_type: "payment_refunded",
              payload: { stripe_refund_id: refund.id },
            });
            const { error: notificationError } = await admin.from("notifications").insert({
              user_id: order.seller_id,
              kind: "payment",
              title: "Zamówienie anulowane",
              body: "Kupujący anulował zamówienie przed wysyłką. Płatność została zwrócona, a oferta jest ponownie aktywna.",
              href: `/zamowienia?order=${order.id}`,
            });
            if (eventError || notificationError)
              console.error("Refund follow-up record requires investigation", order.id);
            return Response.json({ ok: true });
          } catch {
            console.error("Refunded order requires database reconciliation", order.id);
            return Response.json(
              { error: "Płatność zwrócona. Odśwież status ponownie za chwilę." },
              { status: 503 },
            );
          }
        }
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
          if (await hasOpenProblem(order.id))
            return Response.json(
              { error: "Najpierw oznacz zgłoszony problem jako rozwiązany." },
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
            const config = paymentConfig(process.env);
            if (order.stripe_livemode !== config.liveMode) throw new Error("Stripe mode mismatch");
            const accountId =
              sellerAuth.user?.app_metadata?.[
                config.liveMode
                  ? "klockownia_stripe_live_account_id"
                  : "klockownia_stripe_test_account_id"
              ] ??
              (!config.liveMode
                ? sellerAuth.user?.app_metadata?.["klockownia_stripe_account_id"]
                : undefined);
            if (typeof accountId === "string") {
              const transfer = await createDeliveredTransfer(
                new Stripe(config.key),
                accountId,
                {
                  ...order,
                  status: "delivered",
                },
                config.liveMode,
              );
              if (transfer.state === "transferred")
                notificationBody += ` Transfer ${new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" }).format(transfer.amount / 100)} został utworzony.`;
              else if (transfer.state === "not_ready")
                notificationBody += " Dokończ weryfikację Stripe, aby otrzymać transfer.";
            } else {
              notificationBody += " Skonfiguruj Stripe Connect, aby otrzymać transfer.";
            }
          } catch {
            console.error("Automatic transfer requires retry", order.id);
            notificationBody += " Transfer oczekuje na ponowną próbę w panelu sprzedaży.";
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
