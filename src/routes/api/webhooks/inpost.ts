import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { inpostConfig, verifyInpostWebhook } from "@/server/inpost";
import { getSupabaseAdmin, hasSupabaseAdminConfig } from "@/server/supabase-admin";

const eventSchema = z.object({
  customerReference: z.string().uuid().optional(),
  trackingNumber: z.string().trim().min(3).max(100),
  eventId: z.string().trim().min(1).max(200),
  eventCode: z.string().trim().min(1).max(50),
  timestamp: z.string().datetime(),
  location: z
    .object({ name: z.string().nullable().optional(), city: z.string().nullable().optional() })
    .nullable()
    .optional(),
});

function trackingMessage(eventCode: string) {
  if (eventCode === "CRE.1001") return "Etykieta przesyłki została utworzona.";
  if (eventCode.startsWith("EOL.")) return "InPost potwierdził dostarczenie przesyłki.";
  if (eventCode.startsWith("RTS.")) return "Przesyłka jest zwracana do nadawcy.";
  return "InPost zaktualizował status przesyłki.";
}

export const Route = createFileRoute("/api/webhooks/inpost")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!hasSupabaseAdminConfig()) return new Response("Not configured", { status: 503 });
        let config: ReturnType<typeof inpostConfig>;
        try {
          config = inpostConfig();
        } catch {
          return new Response("Webhook is not configured", { status: 503 });
        }
        if (request.headers.get("x-inpost-topic") !== "Shipment.Tracking")
          return new Response("Unsupported topic", { status: 400 });
        const signature = request.headers.get("x-inpost-signature");
        if (!signature) return new Response("Missing signature", { status: 400 });
        const rawBody = await request.text();
        const timestamp = request.headers.get("x-inpost-timestamp");
        if (
          !verifyInpostWebhook(
            rawBody,
            signature,
            config.webhookSignedWithTimestamp ? timestamp : null,
            config.webhookSecret,
          )
        )
          return new Response("Invalid signature", { status: 400 });
        let parsed: z.infer<typeof eventSchema>;
        try {
          parsed = eventSchema.parse(JSON.parse(rawBody));
        } catch {
          return new Response("Invalid payload", { status: 400 });
        }

        const admin = getSupabaseAdmin();
        const { error: eventClaimError } = await admin.from("shipping_webhook_events").insert({
          provider: `inpost:${config.mode}`,
          event_id: parsed.eventId,
        });
        if (eventClaimError) {
          if (eventClaimError.code === "23505") return new Response("OK", { status: 200 });
          return new Response("Retry", { status: 503 });
        }

        let orderQuery = admin
          .from("orders")
          .select("id,buyer_id,status,shipping_livemode")
          .eq("shipping_carrier", "inpost");
        orderQuery = parsed.customerReference
          ? orderQuery.eq("id", parsed.customerReference)
          : orderQuery.eq("tracking_number", parsed.trackingNumber);
        const { data: order, error: orderError } = await orderQuery.maybeSingle();
        if (orderError) {
          await admin
            .from("shipping_webhook_events")
            .delete()
            .eq("provider", `inpost:${config.mode}`)
            .eq("event_id", parsed.eventId);
          return new Response("Retry", { status: 503 });
        }
        if (!order || order.shipping_livemode !== config.liveMode) return new Response("OK", { status: 200 });

        const now = new Date().toISOString();
        const shouldMarkShipped = order.status === "paid" && parsed.eventCode !== "CRE.1001";
        const { data: updatedOrder, error: updateError } = await admin
          .from("orders")
          .update({
            tracking_number: parsed.trackingNumber,
            carrier_status: parsed.eventCode,
            carrier_status_updated_at: parsed.timestamp,
            ...(shouldMarkShipped ? { status: "shipped", shipped_at: now } : {}),
          })
          .eq("id", order.id)
          .or(`carrier_status_updated_at.is.null,carrier_status_updated_at.lte.${parsed.timestamp}`)
          .select("id")
          .maybeSingle();
        if (updateError) {
          await admin
            .from("shipping_webhook_events")
            .delete()
            .eq("provider", `inpost:${config.mode}`)
            .eq("event_id", parsed.eventId);
          return new Response("Retry", { status: 503 });
        }
        if (!updatedOrder) return new Response("OK", { status: 200 });

        await admin.from("order_events").insert({
          order_id: order.id,
          actor_id: null,
          event_type: shouldMarkShipped ? "shipment_marked_shipped" : "carrier_tracking_updated",
          payload: {
            provider: "inpost",
            event_code: parsed.eventCode,
            tracking_number: parsed.trackingNumber,
            location: parsed.location ?? null,
          },
        });
        if (parsed.eventCode !== "CRE.1001")
          await admin.from("notifications").insert({
            user_id: order.buyer_id,
            kind: "shipment",
            title: "Nowy status przesyłki",
            body: `${trackingMessage(parsed.eventCode)} Numer: ${parsed.trackingNumber}.`,
            href: `/zamowienia?order=${order.id}`,
          });
        return new Response("OK", { status: 200 });
      },
    },
  },
});
