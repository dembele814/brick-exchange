import type { SupabaseClient } from "@supabase/supabase-js";
import {
  furgonetkaPlatformAccessToken,
  furgonetkaTrackingState,
  getFurgonetkaPackage,
} from "./furgonetka.ts";

type ShippingOrder = {
  id: string;
  buyer_id: string;
  seller_id: string;
  status: "paid" | "shipped";
  tracking_number: string | null;
  carrier_shipment_id: string;
  carrier_status: string | null;
  shipping_label_ready_at: string | null;
};

export type ShippingReconciliationSummary = {
  checked: number;
  updated: number;
  failures: number;
};

export async function reconcileFurgonetkaShipping(
  admin: SupabaseClient,
  batchSize = 25,
): Promise<ShippingReconciliationSummary> {
  const summary: ShippingReconciliationSummary = { checked: 0, updated: 0, failures: 0 };
  const { data, error } = await admin
    .from("orders")
    .select(
      "id,buyer_id,seller_id,status,tracking_number,carrier_shipment_id,carrier_status,shipping_label_ready_at",
    )
    .eq("shipping_provider", "furgonetka")
    .not("carrier_shipment_id", "is", null)
    .in("status", ["paid", "shipped"])
    .order("carrier_status_updated_at", { ascending: true, nullsFirst: true })
    .limit(batchSize);
  if (error) throw error;

  const accessToken = furgonetkaPlatformAccessToken(admin);
  for (const rawOrder of data ?? []) {
    const order = rawOrder as ShippingOrder;
    summary.checked += 1;
    try {
      const shipment = await getFurgonetkaPackage(await accessToken, order.carrier_shipment_id);
      const trackingNumber = shipment.tracking_number || shipment.trackingNumber || null;
      const tracking = furgonetkaTrackingState(shipment.state, shipment.status);
      const statusChanged = tracking.state !== (order.carrier_status ?? "ordered").toLowerCase();
      const trackingChanged = Boolean(trackingNumber && trackingNumber !== order.tracking_number);
      const shouldMarkShipped = order.status === "paid" && tracking.shipped;
      if (!statusChanged && !trackingChanged && !shouldMarkShipped) continue;

      const now = new Date().toISOString();
      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({
          carrier_status: tracking.state,
          carrier_status_updated_at: now,
          ...(trackingNumber ? { tracking_number: trackingNumber } : {}),
          ...(trackingNumber && !order.shipping_label_ready_at
            ? { shipping_label_ready_at: now }
            : {}),
          ...(shouldMarkShipped ? { status: "shipped", shipped_at: now } : {}),
        })
        .eq("id", order.id)
        .eq("carrier_shipment_id", order.carrier_shipment_id)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) continue;

      await admin.from("order_events").insert({
        order_id: order.id,
        actor_id: null,
        event_type: shouldMarkShipped ? "shipment_marked_shipped" : "carrier_tracking_updated",
        payload: {
          provider: "furgonetka",
          carrier_status: tracking.state,
          tracking_number: trackingNumber,
        },
      });
      if (tracking.message && statusChanged)
        await admin.from("notifications").insert({
          user_id: order.buyer_id,
          kind: "shipment",
          title: "Nowy status przesyłki",
          body: tracking.message,
          href: `/zamowienia?order=${order.id}`,
        });
      summary.updated += 1;
    } catch {
      summary.failures += 1;
    }
  }
  return summary;
}
