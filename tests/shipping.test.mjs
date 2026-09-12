import { test } from "node:test";
import assert from "node:assert/strict";
import { inpostConfig, verifyInpostWebhook } from "../src/server/inpost.ts";
import {
  createOAuthState,
  decryptFurgonetkaToken,
  encryptFurgonetkaToken,
  furgonetkaAuthorizationUrl,
  furgonetkaConfig,
  furgonetkaParcel,
  readOAuthState,
} from "../src/server/furgonetka.ts";
import { enforceRateLimit, RateLimitExceededError } from "../src/server/rate-limit.ts";
import {
  reconciliationAuthorized,
  reconciliationEvent,
  reconciliationSecret,
} from "../src/server/reconciliation.ts";

test("InPost live mode requires an explicit opt-in and separate credentials", () => {
  const stage = inpostConfig({
    INPOST_MODE: "stage",
    INPOST_STAGE_TOKEN: "stage-token",
    INPOST_STAGE_ORGANIZATION_ID: "123",
    INPOST_STAGE_WEBHOOK_SECRET: "stage-secret",
  });
  assert.equal(stage.liveMode, false);
  assert.match(stage.apiUrl, /sandbox/);

  const live = {
    INPOST_MODE: "live",
    INPOST_LIVE_TOKEN: "live-token",
    INPOST_LIVE_ORGANIZATION_ID: "456",
    INPOST_LIVE_WEBHOOK_SECRET: "live-secret",
  };
  assert.throws(() => inpostConfig(live), /disabled/);
  assert.equal(inpostConfig({ ...live, INPOST_LIVE_ENABLED: "true" }).liveMode, true);
});

test("Furgonetka InPost parcel templates stay within locker dimensions", () => {
  assert.deepEqual(furgonetkaParcel("small"), {
    height: 8,
    width: 38,
    depth: 64,
    weight: 5,
    quantity: 1,
    type: "package",
  });
  assert.equal(furgonetkaParcel("medium").height, 19);
  assert.equal(furgonetkaParcel("large").height, 41);
});

test("InPost HMAC verification accepts the official raw-body test vector and rejects changes", () => {
  const body =
    '{"customerReference":"customerReference","trackingNumber":"trackingNumber","eventId":"eventId","eventCode":"eventCode","timestamp":"2024-03-14T10:15:30.120Z","location":null,"delivery":{"recipientName":null,"deliveryNotes":null},"shipment":{"type":"OUTBOUND"},"returnToSender":null,"newDestination":null}';
  const signature = "8XJ/C5JpWFxeZQYFroMBS/JfoHWcVuIxDKtBv0QNP7Q=";
  assert.equal(verifyInpostWebhook(body, signature, null, "fdXbfU27DBNG6LuoHu@ThKl3"), true);
  assert.equal(verifyInpostWebhook(`${body} `, signature, null, "fdXbfU27DBNG6LuoHu@ThKl3"), false);
});

test("Furgonetka OAuth state is signed and its tokens are encrypted", () => {
  const config = furgonetkaConfig({
    FURGONETKA_CLIENT_ID: "client-id",
    FURGONETKA_CLIENT_SECRET: "client-secret",
    FURGONETKA_REDIRECT_URI: "https://shop.example.com/api/furgonetka/callback",
    FURGONETKA_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
  });
  const state = createOAuthState("user-123", config);
  assert.equal(readOAuthState(state, config), "user-123");
  assert.throws(() => readOAuthState(`${state}x`, config), /Nieprawidłowy/);

  const encrypted = encryptFurgonetkaToken("access-token", config);
  assert.equal(encrypted.includes("access-token"), false);
  assert.equal(decryptFurgonetkaToken(encrypted, config), "access-token");

  const authorize = new URL(furgonetkaAuthorizationUrl("user-123", config));
  assert.equal(authorize.origin, "https://api.furgonetka.pl");
  assert.equal(authorize.searchParams.get("redirect_uri"), config.redirectUri);
  assert.equal(authorize.searchParams.get("response_type"), "code");
});

test("server rate limiting hashes identities and rejects exhausted limits", async () => {
  const calls = [];
  const admin = {
    rpc: async (name, input) => {
      calls.push({ name, input });
      return { data: calls.length === 1, error: null };
    },
  };
  await enforceRateLimit(admin, "checkout", "user@example.com", 10, 60);
  await assert.rejects(
    () => enforceRateLimit(admin, "checkout", "user@example.com", 10, 60),
    RateLimitExceededError,
  );
  assert.equal(calls[0].name, "consume_api_rate_limit");
  assert.match(calls[0].input.p_key_hash, /^[0-9a-f]{64}$/);
  assert.equal(JSON.stringify(calls).includes("user@example.com"), false);
});

test("reconciliation endpoint requires a long secret and exact bearer token", () => {
  assert.throws(() => reconciliationSecret({ RECONCILIATION_SECRET: "short" }));
  const secret = "a-secure-reconciliation-secret-123456";
  const request = new Request("https://shop.example.com/api/cron/reconcile", {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}` },
  });
  assert.equal(reconciliationAuthorized(request, secret), true);
  assert.equal(reconciliationAuthorized(request, `${secret}-wrong`), false);
});

test("reconciliation only converts authoritative paid or expired Checkout sessions", () => {
  const base = {
    id: "cs_test_reconcile",
    object: "checkout.session",
    livemode: false,
    payment_status: "unpaid",
    status: "open",
  };
  assert.equal(reconciliationEvent(base), null);
  assert.equal(
    reconciliationEvent({ ...base, payment_status: "paid", status: "complete" }).type,
    "checkout.session.completed",
  );
  assert.equal(
    reconciliationEvent({ ...base, status: "expired" }).type,
    "checkout.session.expired",
  );
});
