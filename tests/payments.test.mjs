import { before, beforeEach, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { paymentConfig, checkoutEvent, sessionParameters } from "../src/server/payments.ts";
import { handleCheckout } from "../src/server/checkout-handler.ts";
import { handleStripeWebhook } from "../src/server/stripe-webhook-handler.ts";
import {
  connectAccountCreateParams,
  connectFeeGrosz,
  sellerProceedsGrosz,
} from "../src/server/connect.ts";

const seller = "11111111-1111-4111-8111-111111111111";
const buyer = "22222222-2222-4222-8222-222222222222";
const otherBuyer = "33333333-3333-4333-8333-333333333333";
const listing = "44444444-4444-4444-8444-444444444444";
const input = {
  listingId: listing,
  carrier: "inpost",
  lockerId: "WAW01M",
  receiver: {
    email: "buyer@example.com",
    phone: "123456789",
    firstName: "Test",
    lastName: "Buyer",
  },
};
const db = new PGlite();
const stripe = new Stripe("sk_test_local_fixture");
const secret = "whsec_local_fixture";
const env = {
  STRIPE_SECRET_KEY: "sk_test_local_fixture",
  STRIPE_WEBHOOK_SECRET: secret,
  APP_URL: "https://shop.example.com/",
  STRIPE_PAYMENTS_ENABLED: "true",
};

test("Connect fee is 1 PLN plus 5 percent and never exceeds the sale", () => {
  assert.equal(connectFeeGrosz(100), 100);
  assert.equal(connectFeeGrosz(1_000), 150);
  assert.equal(connectFeeGrosz(12_345), 717);
  assert.equal(sellerProceedsGrosz(12_345), 11_628);
  assert.throws(() => connectFeeGrosz(0));
});

test("Connect seller account assigns marketplace responsibility and recipient transfers", () => {
  const params = connectAccountCreateParams(
    seller,
    "seller@example.com",
    "https://shop.example.com",
  );
  assert.equal(params.dashboard, "express");
  assert.equal(params.identity.country, "PL");
  assert.equal(params.defaults.responsibilities.fees_collector, "application");
  assert.equal(params.defaults.responsibilities.losses_collector, "application");
  assert.equal(
    params.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested,
    true,
  );
});

before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema auth; create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create publication supabase_realtime;`);
  for (const name of [
    "20260905_initial_marketplace.sql",
    "20260906_multi_carrier_shipping.sql",
    "20260906_notifications.sql",
    "20260907_stripe_payment_safety.sql",
  ]) {
    // PGlite already supplies gen_random_uuid; Supabase supplies pgcrypto remotely.
    const sql = (
      await readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8")
    ).replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
});
beforeEach(async () => {
  await db.exec(`drop trigger if exists fail_notification on public.notifications;
    truncate auth.users cascade;
    insert into auth.users(id) values ('${seller}'), ('${buyer}'), ('${otherBuyer}');
    insert into public.listings(id, seller_id, title, category, theme, condition, price_grosz, status)
    values ('${listing}', '${seller}', 'LEGO test set', 'sets', 'City', 'new', 12345, 'active');`);
});
after(async () => {
  await db.close();
});

test("payment migration can be reapplied without deleting existing orders", async () => {
  const order = await reserve();
  const sql = await readFile(
    new URL("../supabase/migrations/20260907_stripe_payment_safety.sql", import.meta.url),
    "utf8",
  );
  await db.exec(sql);
  assert.equal((await readOrder(order.id)).id, order.id);
});

test("asynchronous failure preserves the failed order and releases its reservation", async () => {
  const order = await reserve();
  await apply(
    checkoutEvent(
      event(order, { payment_status: "unpaid" }, "checkout.session.async_payment_failed"),
    ),
  );
  assert.equal((await readOrder(order.id)).status, "cancelled");
  assert.equal((await readOrder(order.id)).payment_status, "failed");
  assert.notEqual((await reserve(otherBuyer)).id, order.id);
});

test("a legacy order can only be fulfilled by its previously bound session", async () => {
  const order = await reserve();
  await db.query(
    "update orders set checkout_title=null, checkout_origin=null, checkout_expires_at=null where id=$1",
    [order.id],
  );
  const payload = checkoutEvent(
    event(order, { metadata: { order_id: order.id }, client_reference_id: null }),
  );
  await assert.rejects(apply(payload));
  await bind(order);
  await apply(payload);
  assert.equal((await readOrder(order.id)).payment_status, "paid");
});

async function reserve(who = buyer, receiver = input.receiver) {
  const result = await db.query(
    `select public.reserve_stripe_checkout($1,$2,$3,$4,$5,$6) as purchase`,
    [who, listing, input.carrier, input.lockerId, receiver, env.APP_URL.replace(/\/$/, "")],
  );
  return result.rows[0].purchase;
}
async function bind(order, session = "cs_test_one") {
  await db.query("select public.bind_stripe_checkout($1,$2)", [order.id, session]);
}
function event(order, patch = {}, type = "checkout.session.completed", id = "evt_one") {
  return {
    id,
    type,
    livemode: false,
    data: {
      object: {
        id: "cs_test_one",
        object: "checkout.session",
        mode: "payment",
        livemode: false,
        payment_status: "paid",
        status: "complete",
        amount_total: order.amount_grosz,
        currency: "pln",
        client_reference_id: buyer,
        payment_intent: "pi_test_one",
        metadata: { order_id: order.id, integration: "klockownia_checkout_v1" },
        ...patch,
      },
    },
  };
}
async function apply(payload) {
  return db.query(
    "select public.apply_stripe_checkout_event($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
    Object.values(payload),
  );
}
async function readOrder(id) {
  return (await db.query("select * from public.orders where id=$1", [id])).rows[0];
}
async function count(table) {
  return Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
}
function request(body = input, authorization = "Bearer test-user") {
  return new Request("https://shop.example.com/api/checkout", {
    method: "POST",
    headers: { authorization },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}
function adminClient() {
  return {
    auth: { getUser: async () => ({ data: { user: { id: buyer } }, error: null }) },
    rpc: async (name, params) => {
      try {
        if (name === "reserve_stripe_checkout")
          return { data: await reserve(params.p_buyer_id, params.p_receiver), error: null };
        if (name === "bind_stripe_checkout")
          await bind({ id: params.p_order_id }, params.p_session_id);
        else if (name === "apply_stripe_checkout_event") await apply(params);
        return { data: null, error: null };
      } catch (error) {
        return { data: null, error };
      }
    },
  };
}
function signedRequest(value, invalid = false) {
  const body = JSON.stringify(value);
  const signature = stripe.webhooks.generateTestHeaderString({ payload: body, secret });
  return new Request("https://shop.example.com/api/webhooks/stripe", {
    method: "POST",
    headers: { "stripe-signature": signature },
    body: invalid ? body + " " : body,
  });
}

test("test-only opt-in configuration rejects live keys and untrusted redirect origins", () => {
  assert.equal(paymentConfig(env, true).appUrl, "https://shop.example.com");
  assert.throws(() => paymentConfig({ ...env, STRIPE_SECRET_KEY: "sk_live_fixture" }, true));
  assert.throws(() => paymentConfig({ ...env, STRIPE_PAYMENTS_ENABLED: "false" }, true));
  assert.doesNotThrow(() => paymentConfig({ ...env, STRIPE_PAYMENTS_ENABLED: "false" }));
  for (const APP_URL of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com/?redirect=x",
  ]) {
    assert.throws(() => paymentConfig({ ...env, APP_URL }));
  }
});

test("reservation is exclusive and immutable across buyer retries", async () => {
  const order = await reserve();
  await db.query("update listings set title='Changed title', price_grosz=999 where id=$1", [
    listing,
  ]);
  assert.deepEqual(await reserve(), order);
  await assert.rejects(reserve(otherBuyer));
  await assert.rejects(reserve(buyer, { ...input.receiver, phone: "987654321" }));
  assert.equal(await count("orders"), 1);
  const params = sessionParameters(order);
  assert.equal(params.line_items[0].price_data.unit_amount, 12345);
  assert.equal(params.line_items[0].price_data.product_data.name, "LEGO test set");
  assert.equal(params.automatic_payment_methods, undefined);
  assert.equal(params.payment_intent_data.transfer_group, `order_${order.id}`);
  assert.equal(params.payment_intent_data.metadata.platform_fee_grosz, "717");
});

test("self purchase and vacation listings cannot reserve inventory", async () => {
  await assert.rejects(reserve(seller));
  await db.query("update profiles set vacation_mode=true where id=$1", [seller]);
  await assert.rejects(reserve());
  assert.equal(await count("orders"), 0);
});

test("unpaid completion does nothing; async success fulfills exactly once", async () => {
  const order = await reserve();
  assert.equal(checkoutEvent(event(order, { payment_status: "unpaid" })), null);
  assert.equal((await readOrder(order.id)).payment_status, "pending");
  const payload = checkoutEvent(event(order, {}, "checkout.session.async_payment_succeeded"));
  await apply(payload); // Webhook can arrive before checkout's session binding.
  await apply(payload);
  await apply({ ...payload, p_event_id: "evt_second_success" });
  assert.equal((await readOrder(order.id)).payment_status, "paid");
  assert.equal((await readOrder(order.id)).stripe_payment_intent_id, "pi_test_one");
  assert.equal(
    (await db.query("select status from listings where id=$1", [listing])).rows[0].status,
    "sold",
  );
  assert.equal(await count("notifications"), 2);
  assert.equal(await count("order_events"), 1);
});

test("fulfillment rollback includes inventory, order, event dedupe, and notifications", async () => {
  const order = await reserve();
  await db.exec(`create or replace function reject_test_notification() returns trigger language plpgsql as $$ begin raise exception 'test failure'; end; $$;
    create trigger fail_notification before insert on notifications for each row execute function reject_test_notification();`);
  const payload = checkoutEvent(event(order));
  await assert.rejects(apply(payload));
  assert.equal((await readOrder(order.id)).payment_status, "pending");
  assert.equal(
    (await db.query("select status from listings where id=$1", [listing])).rows[0].status,
    "active",
  );
  assert.equal(await count("stripe_checkout_events"), 0);
  assert.equal(await count("order_events"), 0);
  await db.exec("drop trigger fail_notification on notifications");
  await apply(payload);
  assert.equal((await readOrder(order.id)).payment_status, "paid");
  assert.equal(await count("notifications"), 2);
});

test("wrong amount, currency, session, buyer, or integration cannot fulfill", async () => {
  const order = await reserve();
  await bind(order);
  const payload = checkoutEvent(event(order));
  for (const patch of [
    { p_amount: 1 },
    { p_currency: "eur" },
    { p_session_id: "cs_test_wrong" },
    { p_buyer_id: otherBuyer },
    { p_integration: "another" },
  ]) {
    await assert.rejects(apply({ ...payload, ...patch }));
  }
  assert.equal((await readOrder(order.id)).payment_status, "pending");
  assert.equal(await count("stripe_checkout_events"), 0);
});

test("signed session mode, currency, and event account are validated", async () => {
  const order = await reserve();
  for (const patch of [
    { livemode: true },
    { mode: "subscription" },
    { currency: "eur" },
    { amount_total: null },
  ]) {
    assert.throws(() => checkoutEvent(event(order, patch)));
  }
  assert.throws(() => checkoutEvent({ ...event(order), livemode: true }));
  assert.throws(() => checkoutEvent({ ...event(order), account: "acct_other" }));
});

test("expiry retains history and allows a new buyer; stale expiry cannot cancel the new order", async () => {
  const order = await reserve();
  const payload = checkoutEvent(
    event(order, { payment_status: "unpaid", status: "expired" }, "checkout.session.expired"),
  );
  await apply(payload);
  assert.equal((await readOrder(order.id)).status, "cancelled");
  const second = await reserve(otherBuyer);
  await apply({ ...payload, p_event_id: "evt_late_expiry" });
  assert.equal((await readOrder(second.id)).status, "pending_payment");
  assert.equal(await count("orders"), 2);
  await assert.rejects(
    apply(
      checkoutEvent(
        event(order, {}, "checkout.session.async_payment_succeeded", "evt_late_success"),
      ),
    ),
  );
});

test("async failure cancels only a pending payment; late failure cannot regress paid orders", async () => {
  const order = await reserve();
  await apply(checkoutEvent(event(order)));
  await db.query("update orders set status='shipped' where id=$1", [order.id]);
  await apply(
    checkoutEvent(
      event(
        order,
        { payment_status: "unpaid" },
        "checkout.session.async_payment_failed",
        "evt_failed",
      ),
    ),
  );
  assert.equal((await readOrder(order.id)).status, "shipped");
  assert.equal((await readOrder(order.id)).payment_status, "paid");
  assert.equal(await count("notifications"), 2);
});

test("browser roles have no access to trusted payment mutation RPCs", async () => {
  for (const role of ["anon", "authenticated"]) {
    for (const fn of [
      "reserve_stripe_checkout(uuid,uuid,text,text,jsonb,text)",
      "bind_stripe_checkout(uuid,text)",
      "apply_stripe_checkout_event(text,text,uuid,text,integer,text,text,text,text,boolean)",
    ]) {
      const result = await db.query("select has_function_privilege($1,$2,'EXECUTE') as allowed", [
        role,
        fn,
      ]);
      assert.equal(result.rows[0].allowed, false);
    }
  }
});

test("malformed JSON and missing authentication create no orders or Stripe calls", async () => {
  assert.equal(
    (await handleCheckout(request("{broken"), adminClient(), {}, env.APP_URL)).status,
    400,
  );
  assert.equal(
    (await handleCheckout(request(input, ""), adminClient(), {}, env.APP_URL)).status,
    401,
  );
  assert.equal(await count("orders"), 0);
});

test("timeout after Stripe creates a session preserves the reservation and retries the same key", async () => {
  const calls = [];
  const sessions = {
    create: async (params, options) => {
      calls.push({ params, options });
      if (calls.length === 1) throw new Error("response lost after creation");
      return {
        id: "cs_test_one",
        status: "open",
        url: "https://checkout.stripe.com/test",
        livemode: false,
      };
    },
  };
  await assert.rejects(
    handleCheckout(request(), adminClient(), { checkout: { sessions } }, env.APP_URL),
  );
  assert.equal(await count("orders"), 1);
  const response = await handleCheckout(
    request(),
    adminClient(),
    { checkout: { sessions } },
    env.APP_URL,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0], calls[1]);
  assert.equal(await count("orders"), 1);
});

test("binding failure is retryable and an existing session is retrieved instead of recreated", async () => {
  const order = await reserve();
  const sessions = {
    create: async () => ({
      id: "cs_test_one",
      status: "open",
      url: "https://checkout.stripe.com/test",
      livemode: false,
    }),
  };
  const admin = adminClient();
  const badAdmin = {
    ...admin,
    rpc: async (name, params) =>
      name === "bind_stripe_checkout" ? { error: { code: "failure" } } : admin.rpc(name, params),
  };
  await assert.rejects(
    handleCheckout(request(), badAdmin, { checkout: { sessions } }, env.APP_URL),
  );
  assert.equal((await readOrder(order.id)).status, "pending_payment");
  await bind(order);
  sessions.create = async () => {
    throw new Error("must not recreate");
  };
  sessions.retrieve = async () => ({
    id: "cs_test_one",
    status: "open",
    url: "https://checkout.stripe.com/test",
    livemode: false,
  });
  assert.equal(
    (await handleCheckout(request(), admin, { checkout: { sessions } }, env.APP_URL)).status,
    200,
  );
});

test("old ambiguous reservation is retained for reconciliation without another Stripe create", async () => {
  const order = await reserve();
  await db.query("update orders set checkout_expires_at=1 where id=$1", [order.id]);
  assert.equal((await handleCheckout(request(), adminClient(), {}, env.APP_URL)).status, 409);
  assert.equal((await readOrder(order.id)).payment_status, "pending");
});

test("real SDK signature verification rejects tampering and retries a failed database transaction", async () => {
  const order = await reserve();
  const value = event(order);
  assert.equal(
    (await handleStripeWebhook(signedRequest(value, true), stripe, secret, adminClient)).status,
    400,
  );
  assert.equal(await count("stripe_checkout_events"), 0);
  assert.equal(
    (
      await handleStripeWebhook(signedRequest(value), stripe, secret, () => ({
        rpc: async () => ({ error: { code: "offline" } }),
      }))
    ).status,
    500,
  );
  assert.equal(
    (await handleStripeWebhook(signedRequest(value), stripe, secret, adminClient)).status,
    200,
  );
  assert.equal((await readOrder(order.id)).status, "paid");
});
