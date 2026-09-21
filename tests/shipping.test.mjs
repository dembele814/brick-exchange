import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inpostConfig,
  searchInpostPoints,
  validateInpostPoint,
  verifyInpostWebhook,
} from "../src/server/inpost.ts";
import {
  createOAuthState,
  decryptFurgonetkaToken,
  encryptFurgonetkaToken,
  furgonetkaAuthorizationUrl,
  furgonetkaConfig,
  furgonetkaOrderCommandError,
  furgonetkaParcel,
  furgonetkaTrackingState,
  getFurgonetkaOrderCommand,
  isFurgonetkaLabelReady,
  orderFurgonetkaPackage,
  readOAuthState,
  resolveFurgonetkaAccountUserId,
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

test("InPost point search corrects BI01H and supports nearest-point coordinates", async () => {
  const originalFetch = globalThis.fetch;
  const requested = [];
  globalThis.fetch = async (url) => {
    requested.push(String(url));
    return Response.json({
      items: [
        {
          name: "BIA01H",
          display_name: "InPost Paczkomat BIA01H",
          status: "Operating",
          location: { latitude: 53.13114, longitude: 23.19712 },
          address: { line1: "Kwiatowa 4", line2: "00-001 Warszawa" },
          address_details: { city: "Warszawa" },
          location_description: "W lokalu, obok apteki",
          opening_hours: "24/7",
          distance: requested.length === 1 ? null : 125,
        },
      ],
    });
  };
  try {
    const byCode = await searchInpostPoints({ query: "BI01H" });
    assert.match(requested[0], /query=BIA01H/);
    assert.equal(byCode[0].id, "BIA01H");
    assert.equal(byCode[0].address, "Kwiatowa 4, 00-001 Warszawa");
    assert.equal(byCode[0].distanceMeters, null);

    const nearby = await searchInpostPoints({
      latitude: 53.13,
      longitude: 23.2,
      radiusMeters: 900_000,
      limit: 999,
    });
    assert.match(requested[1], /relative_point=53\.13%2C23\.2/);
    assert.match(requested[1], /sort_by=distance_to_relative_point/);
    assert.match(requested[1], /max_distance=700000/);
    assert.match(requested[1], /per_page=100/);
    assert.equal(nearby[0].distanceMeters, 125);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("checkout validates map selections against the public production point directory", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return Response.json({ name: "BIA01H", status: "Operating", type: "parcel_locker" });
  };
  try {
    const point = await validateInpostPoint("bia01h");
    assert.match(requestedUrl, /^https:\/\/api-shipx-pl\.easypack24\.net\/v1\/points\/BIA01H$/);
    assert.equal(point.id, "BIA01H");
  } finally {
    globalThis.fetch = originalFetch;
  }
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

test("Furgonetka tracking states only mark physically handled parcels as shipped", () => {
  assert.equal(furgonetkaTrackingState("ordered").shipped, false);
  assert.equal(furgonetkaTrackingState("collected").shipped, true);
  assert.equal(furgonetkaTrackingState("transit").message, "Przesyłka jest w drodze.");
  assert.match(furgonetkaTrackingState("delivered").message, /potwierdź odbiór/);
  assert.equal(furgonetkaTrackingState("waiting").message, null);
});

test("one marketplace Furgonetka account serves every seller", () => {
  assert.equal(resolveFurgonetkaAccountUserId([{ user_id: "platform-user" }]), "platform-user");
  assert.equal(
    resolveFurgonetkaAccountUserId(
      [{ user_id: "old-account" }, { user_id: "new-account" }],
      "configured-platform-user",
    ),
    "configured-platform-user",
  );
  assert.throws(() => resolveFurgonetkaAccountUserId([]), /nie jest jeszcze połączone/);
  assert.throws(
    () => resolveFurgonetkaAccountUserId([{ user_id: "one" }, { user_id: "two" }]),
    /Wybierz konto wysyłkowe/,
  );
});

test("Furgonetka purchase commands are resumable with one stable UUID", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), method: init.method ?? "GET", body: init.body });
    if (init.method === "PUT") return Response.json({ uuid: "stable-command" });
    return Response.json({
      uuid: "stable-command",
      status: "successful",
      successfully_ordered_packages: ["package-123"],
      errors: [],
    });
  };
  try {
    assert.equal(
      await orderFurgonetkaPackage("token", "package-123", "stable-command"),
      "stable-command",
    );
    const command = await getFurgonetkaOrderCommand("token", "stable-command");
    assert.equal(command.status, "successful");
    assert.equal(calls[0].url, "https://api.furgonetka.pl/order-commands/stable-command");
    assert.equal(calls[0].method, "PUT");
    assert.deepEqual(JSON.parse(calls[0].body).packages, [{ id: "package-123" }]);
    assert.equal(calls[1].method, "GET");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Furgonetka order command exposes a useful carrier error", () => {
  assert.equal(
    furgonetkaOrderCommandError({
      status: "error",
      errors: [{ message: "Brak środków", details: "Doładuj saldo Furgonetki." }],
    }),
    "Doładuj saldo Furgonetki.",
  );
});

test("Furgonetka label readiness distinguishes an unfinished 204 from a PDF", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 204 });
    assert.equal(await isFurgonetkaLabelReady("token", "package-123"), false);

    globalThis.fetch = async () =>
      new Response(new Uint8Array([37, 80, 68, 70]), {
        status: 200,
        headers: { "Content-Type": "application/pdf" },
      });
    assert.equal(await isFurgonetkaLabelReady("token", "package-123"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
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
