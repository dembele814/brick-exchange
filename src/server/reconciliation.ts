import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash, timingSafeEqual } from "node:crypto";
import { checkoutEvent, refundPayment } from "./payments.ts";
import { connectAccountIdFor, createDeliveredTransfer } from "./connect.ts";

type Summary = {
  pendingPaymentsChecked: number;
  refundsCompleted: number;
  transfersCompleted: number;
  failures: number;
};

export function reconciliationSecret(env: Record<string, string | undefined> = process.env) {
  const secret = env["RECONCILIATION_SECRET"];
  if (!secret || secret.length < 32) throw new Error("RECONCILIATION_SECRET is not configured");
  return secret;
}

export function reconciliationAuthorized(request: Request, secret: string) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const expected = createHash("sha256").update(secret).digest();
  const received = createHash("sha256").update(token).digest();
  return timingSafeEqual(expected, received);
}

export function reconciliationEvent(session: Stripe.Checkout.Session): Stripe.Event | null {
  const type =
    session.payment_status === "paid"
      ? "checkout.session.completed"
      : session.status === "expired"
        ? "checkout.session.expired"
        : null;
  if (!type) return null;
  return {
    id: `reconcile_${session.id}_${type}`,
    object: "event",
    api_version: null,
    created: Math.floor(Date.now() / 1000),
    data: { object: session },
    livemode: session.livemode,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

async function reconcilePendingPayments(
  admin: SupabaseClient,
  stripe: Stripe,
  liveMode: boolean,
  summary: Summary,
  batchSize: number,
) {
  const { data: orders, error } = await admin
    .from("orders")
    .select("id,stripe_checkout_session_id")
    .eq("status", "pending_payment")
    .eq("payment_status", "pending")
    .eq("stripe_livemode", liveMode)
    .not("stripe_checkout_session_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  for (const order of orders ?? []) {
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      const event = reconciliationEvent(session);
      if (event) {
        const payload = checkoutEvent(event, liveMode);
        if (payload) {
          const { error: applyError } = await admin.rpc("apply_stripe_checkout_event", payload);
          if (applyError) throw applyError;
        }
      }
      summary.pendingPaymentsChecked += 1;
    } catch {
      summary.failures += 1;
    }
  }
}

async function reconcileRefunds(
  admin: SupabaseClient,
  stripe: Stripe,
  liveMode: boolean,
  summary: Summary,
  batchSize: number,
) {
  const { data: orders, error } = await admin
    .from("orders")
    .select("id,listing_id,payment_status,stripe_payment_intent_id,stripe_livemode")
    .eq("status", "cancelled")
    .eq("payment_status", "paid")
    .eq("stripe_livemode", liveMode)
    .not("stripe_payment_intent_id", "is", null)
    .order("updated_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  for (const order of orders ?? []) {
    try {
      const transfers = await stripe.transfers.list({
        transfer_group: `order_${order.id}`,
        limit: 10,
      });
      for (const transfer of transfers.data.filter(
        (item) => item.amount_reversed < item.amount && !item.reversed,
      ))
        await stripe.transfers.createReversal(
          transfer.id,
          {
            amount: transfer.amount - transfer.amount_reversed,
            metadata: { order_id: order.id, integration: "klockownia_reconciliation_v1" },
          },
          { idempotencyKey: `klockownia-reversal:${order.id}:${transfer.id}:v1` },
        );

      const refund = await refundPayment(stripe, order, liveMode);
      if (refund.status !== "succeeded") continue;
      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({
          payment_status: "refunded",
          seller_transfer_status: transfers.data.length ? "reversed" : null,
          reconciliation_attempted_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "cancelled")
        .eq("payment_status", "paid")
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) continue;
      await admin.from("listings").update({ status: "active" }).eq("id", order.listing_id);
      await admin.from("order_events").insert({
        order_id: order.id,
        actor_id: null,
        event_type: "payment_refunded",
        payload: { stripe_refund_id: refund.id, reconciled: true },
      });
      summary.refundsCompleted += 1;
    } catch {
      summary.failures += 1;
    }
  }
}

async function reconcileTransfers(
  admin: SupabaseClient,
  stripe: Stripe,
  liveMode: boolean,
  summary: Summary,
  batchSize: number,
) {
  const { data: orders, error } = await admin
    .from("orders")
    .select(
      "id,seller_id,amount_grosz,status,payment_status,stripe_payment_intent_id,stripe_livemode",
    )
    .eq("status", "delivered")
    .eq("payment_status", "paid")
    .eq("stripe_livemode", liveMode)
    .is("seller_transfer_id", null)
    .order("delivered_at", { ascending: true })
    .limit(batchSize);
  if (error) throw error;

  for (const order of orders ?? []) {
    try {
      const { data: seller } = await admin.auth.admin.getUserById(order.seller_id);
      const accountId = seller.user ? connectAccountIdFor(seller.user, liveMode) : undefined;
      if (!accountId) continue;
      const transfer = await createDeliveredTransfer(stripe, accountId, order, liveMode);
      if (transfer.state !== "transferred") continue;
      const { data: updated, error: updateError } = await admin
        .from("orders")
        .update({
          seller_transfer_id: transfer.transferId,
          seller_transfer_status: "paid",
          seller_transferred_at: new Date().toISOString(),
          reconciliation_attempted_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .is("seller_transfer_id", null)
        .select("id")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) continue;
      await admin.from("notifications").insert({
        user_id: order.seller_id,
        kind: "payment",
        title: "Wypłata została uruchomiona",
        body: "Automatycznie ponowiliśmy transfer po potwierdzeniu odbioru.",
        href: "/portfel",
      });
      summary.transfersCompleted += 1;
    } catch {
      summary.failures += 1;
    }
  }
}

export async function reconcileStripeMoney(
  admin: SupabaseClient,
  stripe: Stripe,
  liveMode: boolean,
  batchSize = 25,
) {
  const summary: Summary = {
    pendingPaymentsChecked: 0,
    refundsCompleted: 0,
    transfersCompleted: 0,
    failures: 0,
  };
  const { data: run, error: runError } = await admin
    .from("reconciliation_runs")
    .insert({ mode: liveMode ? "live" : "test" })
    .select("id")
    .single();
  if (runError) throw runError;

  await reconcilePendingPayments(admin, stripe, liveMode, summary, batchSize);
  await reconcileRefunds(admin, stripe, liveMode, summary, batchSize);
  await reconcileTransfers(admin, stripe, liveMode, summary, batchSize);

  await admin
    .from("reconciliation_runs")
    .update({
      finished_at: new Date().toISOString(),
      pending_payments_checked: summary.pendingPaymentsChecked,
      refunds_completed: summary.refundsCompleted,
      transfers_completed: summary.transfersCompleted,
      failures: summary.failures,
    })
    .eq("id", run.id);
  return summary;
}
