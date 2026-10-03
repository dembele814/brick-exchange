import { test } from "node:test";
import assert from "node:assert/strict";
import { authenticatedRequest } from "../src/lib/authenticated-request.ts";
import { handleCheckout } from "../src/server/checkout-handler.ts";

test("expired access token refreshes once and preserves the checkout body", async () => {
  let refreshes = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "old" } } }),
      refreshSession: async () => {
        refreshes++;
        return { data: { session: { access_token: "fresh" } } };
      },
    },
  };
  const calls = [];
  const response = await authenticatedRequest(
    client,
    "/api/checkout",
    { method: "POST", body: "same-order" },
    async (_url, init) => {
      calls.push(init);
      return new Response("", { status: calls.length === 1 ? 401 : 200 });
    },
  );
  assert.equal(response.status, 200);
  assert.equal(refreshes, 1);
  assert.equal(calls[1].headers.get("Authorization"), "Bearer fresh");
  assert.equal(calls[0].body, calls[1].body);
});

test("infrastructure failure never causes refresh or duplicate checkout submission", async () => {
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "valid" } } }),
      refreshSession: async () => {
        throw new Error("must not refresh");
      },
    },
  };
  let calls = 0;
  const response = await authenticatedRequest(client, "/api/checkout", {}, async () => {
    calls++;
    return new Response("", { status: 503 });
  });
  assert.equal(response.status, 503);
  assert.equal(calls, 1);
});

test("missing session cannot submit checkout", async () => {
  await assert.rejects(
    authenticatedRequest(
      { auth: { getSession: async () => ({ data: { session: null } }) } },
      "/api/checkout",
      {},
      async () => {
        assert.fail("must not submit");
      },
    ),
  );
});

test("a repeated 401 is returned after exactly one refresh", async () => {
  let calls = 0;
  const client = {
    auth: {
      getSession: async () => ({ data: { session: { access_token: "old" } } }),
      refreshSession: async () => ({ data: { session: { access_token: "fresh" } } }),
    },
  };
  const response = await authenticatedRequest(client, "/api/checkout", {}, async () => {
    calls++;
    return new Response("", { status: 401 });
  });
  assert.equal(response.status, 401);
  assert.equal(calls, 2);
});

test("Supabase network failures are 503, invalid user tokens remain 401", async () => {
  for (const [error, expected] of [
    [{ name: "AuthRetryableFetchError", status: 0 }, 503],
    [{ name: "AuthApiError", status: 503 }, 503],
    [{ name: "AuthApiError", status: 401 }, 401],
  ]) {
    const admin = {
      auth: { getUser: async () => ({ data: { user: null }, error }) },
      rpc: () => assert.fail("must not reserve"),
    };
    const response = await handleCheckout(
      new Request("https://local.test/api/checkout", {
        method: "POST",
        headers: { authorization: "Bearer user-token" },
        body: "{}",
      }),
      admin,
      {},
      "https://local.test",
    );
    assert.equal(response.status, expected);
    if (expected === 503) assert.doesNotMatch((await response.json()).error, /Zaloguj/);
  }
});
