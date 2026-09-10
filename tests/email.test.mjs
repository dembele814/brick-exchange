import test from "node:test";
import assert from "node:assert/strict";
import { emailConfig, notificationEmail, processEmailOutbox } from "../src/server/email.ts";

const baseEnv = {
  EMAIL_ENABLED: "true",
  EMAIL_MODE: "test",
  EMAIL_LIVE_ENABLED: "false",
  RESEND_API_KEY: "re_fixture",
  EMAIL_FROM: "Klockownia <powiadomienia@send.example.com>",
  EMAIL_TEST_RECIPIENT: "owner@example.com",
  APP_URL: "https://shop.example.com",
};

test("transactional email requires an explicit live opt-in and HTTPS", () => {
  assert.equal(emailConfig(baseEnv).mode, "test");
  assert.throws(() => emailConfig({ ...baseEnv, EMAIL_MODE: "live" }));
  assert.throws(() =>
    emailConfig({ ...baseEnv, EMAIL_MODE: "live", EMAIL_LIVE_ENABLED: "true", APP_URL: "http://shop.example.com" }),
  );
  assert.equal(
    emailConfig({ ...baseEnv, EMAIL_MODE: "live", EMAIL_LIVE_ENABLED: "true" }).mode,
    "live",
  );
});

test("email template escapes notification content and keeps a trusted application link", () => {
  const result = notificationEmail(
    { subject: "Płatność <potwierdzona>", body: "Kwota & status", href: "/zamowienia?order=123" },
    emailConfig(baseEnv),
  );
  assert.match(result.html, /Płatność &lt;potwierdzona&gt;/);
  assert.match(result.html, /Kwota &amp; status/);
  assert.match(result.html, /https:\/\/shop\.example\.com\/zamowienia\?order=123/);
});

test("worker redirects test messages and sends a stable idempotency key", async () => {
  const updates = [];
  const chain = {
    eq() { return this; },
    then(resolve) { resolve({ error: null }); },
  };
  const admin = {
    rpc: async () => ({
      data: [{ id: 42, user_id: "user-1", kind: "payment", subject: "Płatność potwierdzona", body: "Zamówienie opłacone", href: "/zamowienia", attempt_count: 1 }],
      error: null,
    }),
    auth: { admin: { getUserById: async () => ({ data: { user: { email: "buyer@example.com" } }, error: null }) } },
    from: () => ({ update(value) { updates.push(value); return chain; } }),
  };
  let request;
  const fetcher = async (_url, init) => {
    request = init;
    return new Response(JSON.stringify({ id: "email_123" }), { status: 200 });
  };
  const summary = await processEmailOutbox(admin, emailConfig(baseEnv), 10, fetcher);
  const body = JSON.parse(request.body);
  assert.deepEqual(summary, { claimed: 1, sent: 1, failed: 0, skipped: 0 });
  assert.deepEqual(body.to, ["owner@example.com"]);
  assert.equal(request.headers["Idempotency-Key"], "klockownia-email-42-v1");
  assert.equal(updates.at(-1).provider_message_id, "email_123");
});
