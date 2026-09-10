import { test } from "node:test";
import assert from "node:assert/strict";
import { inpostConfig, verifyInpostWebhook } from "../src/server/inpost.ts";
import { enforceRateLimit, RateLimitExceededError } from "../src/server/rate-limit.ts";

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

test("InPost HMAC verification accepts the official raw-body test vector and rejects changes", () => {
  const body =
    '{"customerReference":"customerReference","trackingNumber":"trackingNumber","eventId":"eventId","eventCode":"eventCode","timestamp":"2024-03-14T10:15:30.120Z","location":null,"delivery":{"recipientName":null,"deliveryNotes":null},"shipment":{"type":"OUTBOUND"},"returnToSender":null,"newDestination":null}';
  const signature = "8XJ/C5JpWFxeZQYFroMBS/JfoHWcVuIxDKtBv0QNP7Q=";
  assert.equal(verifyInpostWebhook(body, signature, null, "fdXbfU27DBNG6LuoHu@ThKl3"), true);
  assert.equal(verifyInpostWebhook(`${body} `, signature, null, "fdXbfU27DBNG6LuoHu@ThKl3"), false);
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
