# Klockownia: Payments + Connect review

Status: planner-guided review and local payment hardening, 2026-09-06.
The user selected `wojcik industries` (`acct_1UCjeV2KczG9r5pt`) for read-only
planning in its live MCP context. The `stripe_implementation_planner` returned
and accepted guide `iguide_61VM7rVBOXL3IJvml412KczG9r5pt`, with hosted Checkout
on the web. Its marketplace path recommends Connect, Express Dashboard access,
and destination charges by default if immediate transfers are appropriate.
Business decisions below remain assumptions, not approvals to move money.
No Stripe payments, accounts, settings, secrets, or webhook destinations were
created or changed. Only local code, tests, and documentation were changed.

## Product and baseline payment flow

Klockownia is a Polish web marketplace for physical LEGO goods. The application
uses React, TanStack Start server routes, Supabase Auth/Postgres/RLS, and Stripe's
Node SDK. A buyer buys one listing from one seller, in PLN. Prices are stored as
integer grosz. The buyer supplies a carrier, pickup point, and recipient details.

Before this change, `src/routes/api/checkout.ts` authenticated the buyer, loaded a server-side price,
checks listing availability and vacation mode, inserts an order, creates a hosted
Checkout Session, and saves its ID. The browser redirects to the returned URL.
`src/routes/api/webhooks/stripe.ts` verifies the raw-body signature, marks orders
paid, marks listings sold, and adds order events and notifications. The success
page correctly says that operator confirmation is still pending.

There is no Connect onboarding, connected-account mapping, commission calculation,
transfer, payout, refund, dispute, or reconciliation implementation. Checkout
currently creates a payment on the platform account without a seller destination.
Delivery confirmation only changes application state; it does not release money.
The wallet and top-up functions are local simulated state, not a Stripe balance or
funded payment ledger.

## Findings in the original implementation

| Priority | Finding | Required correction |
| --- | --- | --- |
| Critical | `checkout.session.completed` unconditionally marks an order paid, even if payment is asynchronous and unpaid. | Require `payment_status === "paid"`; handle asynchronous success and failure separately. |
| Critical | A payment is associated using only `metadata.order_id`. Session identity, amount, currency, and mode are not checked against the saved order. | Validate those fields before fulfillment and reject mismatches for operator investigation. |
| Critical | Order payment, listing state, audit events, and notifications are separate database writes. A retry after partial success skips the remaining work. | Apply the transition and side effects in a single Postgres transaction; record the Stripe event ID in the same transaction for durable deduplication. |
| Critical | Checkout deletes an order on any error, including a timeout or failure after Stripe has created a payable session. | Preserve ambiguous reservations; use a stable per-order Stripe idempotency key and reconciliation. Never free inventory merely because an HTTP request failed. |
| High | No explicit server-side purchase enablement or mode guard. The environment example defaults to a live key. | Default to disabled test-mode configuration; block live marketplace launch until Connect and financial operations are ready. |
| High | `automatic_payment_methods` is sent to Checkout Sessions. | Use documented Checkout Session parameters and Dashboard-managed payment methods; verify against the installed Stripe SDK. |
| High | Expired orders are deleted, erasing their audit trail. Asynchronous failures are ignored. | Retain cancelled/failed orders and their events; release their reservation using a partial unique constraint that permits a new order after cancellation. |
| High | An insert-time unique constraint prevents duplicate orders, but repeat requests do not recover the buyer's existing session. | Make reservation and retry behavior atomic; persist the immutable price/title/recipient snapshot used for Stripe retries. |
| High | Listings can be edited while a payment is pending. | Reserve under a listing row lock and define whether edits are blocked or a snapshot governs the transaction. |
| Medium | Invalid JSON and some database/auth failures escape controlled responses. | Return a validation response for malformed input and a retryable response for infrastructure failures. Avoid logging raw payment objects or recipient details. |
| Medium | Shipping and buyer-protection fees are not in the server total. | Agree fee/tax policy, display an itemized total, calculate it on the server, and snapshot it before charging. Do not invent fees. |
| Medium | The wallet UI presents simulated top-ups as if they were real. | Label or disable the demo flow before test rollout; implement a separate audited feature only if stored value is actually required. |

## Implemented and verified locally

* `STRIPE_PAYMENTS_ENABLED=true` is required to start Checkout. Only `sk_test_`
  credentials are accepted; live keys are rejected in code. Pausing Checkout
  does not pause the webhook for already-created test payments.
* Checkout uses a trusted, validated application origin, valid Session parameters,
  and an immutable database snapshot of the title, price, origin, recipient, and
  one-hour expiry. The same buyer can retry with the same delivery details.
  A stable `checkout:<order UUID>:v1` Stripe idempotency key recovers a lost
  response. Existing sessions are retrieved, and uncertain failures never delete
  the reservation. An unbound session is not recreated once fewer than 30 minutes
  remain, because Stripe's minimum expiry and idempotency rules require recovery.
* `reserve_stripe_checkout` locks the listing before reserving it. Price/title
  edits after reservation do not change the buyer's saved purchase snapshot.
* `apply_stripe_checkout_event` validates order/session identity, amount, currency,
  and the new integration's buyer reference. The HTTP handler validates signatures,
  mode, account scope, and actual payment status. Paid orders, sold inventory,
  deduplication records, audit events, and notifications commit in one transaction.
* Expiry and asynchronous failure cancel pending orders while retaining history.
  The partial unique index allows another purchase after cancellation. Late
  failures cannot regress paid/shipped orders; late success after cancellation
  fails visibly for operator investigation. Legacy sessions require a previously
  saved matching session ID; ambiguous legacy orders need manual reconciliation.
* Database mutation RPCs are executable only by `service_role`. Browser roles
  cannot forge a payment or reserve for another buyer.
* The wallet is labelled as a demonstration and its top-up button is disabled.
  There is no real stored-value feature or seller payout balance.

Apply `supabase/migrations/20260907_stripe_payment_safety.sql` after the existing
marketplace, multi-carrier shipping, and notification migrations. It retains
orders and adds three server-only RPCs and the Stripe event ledger. The filename
sorts after existing migrations; it is not a scheduled action. This migration was
tested locally and has **not** been applied to Supabase.

Operational limit: an unbound reservation can remain blocked after a persistent
Stripe error. An operator must locate the session via its order metadata and
idempotency request, bind/replay the matching event, or verify there is no payable
session before cancelling the order. Never release such orders solely by age.
An automated reconciliation worker and rate limiting/abuse controls remain launch
work. Cancellation via the browser's return link does not expire a Stripe session;
the reservation remains until Stripe reports expiry or an operator reconciles it.

## Proposed Payments + Connect architecture

Keep hosted Checkout for one-time purchases; a Stripe publishable key is not
needed for the current server-created Session URL redirect. Use Connect for
seller onboarding and proceeds, with Stripe-hosted onboarding rather than
collecting identity or bank documents in Klockownia.

The charge model depends on the business's release policy:

* If proceeds should move to the seller immediately after payment, destination
  charges match a one-seller order. Save the seller's connected account on the
  order and calculate an agreed application fee server-side.
* If proceeds should be transferred only after delivery/review, use separate
  charges and transfers with an order-specific transfer group. A durable worker
  must create at most one transfer for the eligible amount after payment success,
  funds availability, and the agreed release condition. A bank payout is separate
  from a platform-to-connected-account transfer. Do not describe this as escrow.

The repository has delivery confirmation, but does not establish a contractual
funds-release policy. Do not select the second model merely because that button
exists. Confirm who is merchant of record, platform fee, shipping cost allocation,
refund/dispute responsibility, seller countries, and payout timing before launch.

Remaining Connect implementation sequence:

1. Deploy and exercise the hardened Checkout and transactional webhook in an
   isolated test environment, with no real charges or seller payouts.
2. Add a private server-controlled seller-to-Stripe-account mapping, separately
   scoped by test/live environment. Sellers must not be able to edit account IDs,
   readiness flags, transfer amounts, or fees through browser RLS access.
3. Add authenticated onboarding creation/refresh routes using trusted APP_URL
   redirects. Persist the account before generating links. Use idempotency for
   account creation and verify ownership on every operation. Returning from
   onboarding is not proof of capability approval.
4. Fetch authoritative account requirements/capabilities; gate checkout or
   transfers on the capabilities needed for the chosen charge model. Reconcile
   account changes via a separate Connect event destination.
5. Add immutable order pricing/fee/destination snapshots, the chosen charge flow,
   refund handling, dispute holds, transfer reversals, and reconciliation.
6. Add seller payout status and transaction history based on Stripe and durable
   database records. Keep buyer wallet top-ups outside the initial scope.
7. Exercise the test matrix below before enabling a production rollout.

The planner recommends the current Accounts v2 approach for new Connect account
work. Follow its account configuration, Express Dashboard, requirements, and
capability guidance when implementing onboarding; do not mix v1 capability fields
with v2 account objects. The present code does not create accounts with either API.
For destination charges, the planner recommends Dashboard platform pricing rules;
explicit `application_fee_amount` overrides those rules. For separate charges and
transfers, retain the agreed fee by transferring less; do not set
`application_fee_amount` on that charge type. No fee has been invented here.

Stripe references consulted through the connected tools and official documentation:

* [Hosted Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment)
* [Destination charges](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/destination-charges)
* [Separate charges and transfers](https://docs.stripe.com/connect/marketplace/tasks/accept-payment/separate-charges-and-transfers)
* [Webhook signatures, destinations, and retries](https://docs.stripe.com/webhooks)

## Exact current configuration requirements

These are variable names and sources, not secret values. Do not paste actual
credentials into chat or commit them. Configure them in the hosting provider's
server secret store; use a gitignored local environment file for local testing.

| Variable | Test environment | Production environment |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Isolated Supabase project URL | Production Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Public project publishable/anon key | Public production publishable/anon key |
| `KLOCKOWNIA_SERVICE_ROLE_KEY` (or local `SUPABASE_SERVICE_ROLE_KEY`) | Server-only Supabase secret/service-role key for the same project | Server-only secret/service-role key for production |
| `STRIPE_SECRET_KEY` | Platform `sk_test_…` from the selected sandbox/test account | Platform `sk_live_…`, only after production readiness |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` for the exact test destination, or the CLI listener secret for local testing | Separate `whsec_…` for the live platform destination |
| `STRIPE_PAYMENTS_ENABLED` | `false` by default; set to exactly `true` only after schema and test configuration | Keep `false`; this code rejects live keys even if set to `true` |
| `APP_URL` | Exact local/staging application origin, e.g. `http://localhost:3000` if the dev server actually uses that port | Canonical public HTTPS origin without trailing slash |

Never prefix server secrets with `VITE_`. No Connect client ID, restricted key,
publishable Stripe key, or additional Connect signing secret is currently read by
the code. A future Connect destination should have its own secret and handler;
do not configure an invented environment variable and expect it to work today.
The carrier variables in `.env.example` concern fulfillment, not Stripe payments.

## Webhook setup and remaining user actions

**Production marketplace payments are intentionally blocked in this code.**
Connect money movement and the production operational flows remain to be built.

For test mode:

1. Connect a sandbox/test context if account-specific test inspection is desired.
   Account selection for read-only planning is complete. The exposed live MCP
   context does not provide test credentials or establish sandbox availability.
2. Create/select an isolated Stripe sandbox and Supabase staging database. Apply
   the repository's required schema migrations, then the payment-hardening
   migration (`20260907_stripe_payment_safety.sql`). `supabase/FINAL_CATCHUP.sql` is not a replacement for the initial
   schema and currently contains no payment hardening.
3. Set the variables above using credentials from that environment. Verify that
   the deployment executes server routes and does not serve only static assets.
4. Create a Stripe Workbench event destination for **Your account**, using
   **snapshot events**, at `https://YOUR_DOMAIN/api/webhooks/stripe`. Select the
   API version **`2026-08-26.dahlia`**, matching the pinned **Stripe SDK 22.6.1**.
5. Configure `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, and `checkout.session.expired`.
   Also select `checkout.session.async_payment_failed`. All four are implemented.
6. Copy that destination's signing secret into `STRIPE_WEBHOOK_SECRET`. A CLI
   listener has a different secret from a Dashboard destination. For local
   testing, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
   with the actual dev-server port and the selected test account; use its printed
   secret locally. Never add `--live` to this test procedure. To limit delivery:

   ```sh
   stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/webhooks/stripe
   ```
7. Register two test users, publish a test listing, and buy it through the actual
   application. A generic CLI fixture does not contain an existing Klockownia
   order or its session binding and is insufficient to prove fulfillment. Set
   `STRIPE_PAYMENTS_ENABLED=true` for this test rollout. Use Stripe's test payment
   methods; select card/BLIK/P24 in the test Dashboard only where available for
   the chosen account, currency, and eventual Connect flow. No method availability
   was inferred from the live account or tested remotely in this task.

Required test cases: immediate success; asynchronous completion that remains
unpaid; later async success/failure; invalid signatures; changed body; duplicate
and out-of-order deliveries; wrong amount/currency/session/mode; two buyers racing
for one listing; retries after a lost HTTP response; session expiry and resale;
database failure between fulfillment effects; and recovery of ambiguous sessions.

For production, first complete Connect onboarding/readiness, the agreed funds
flow, fees/shipping/tax policy, refunds/disputes/reversals, and operational alerts
and reconciliation. Validate these with test connected accounts. Then activate
the platform and sellers, use separate live credentials/database configuration,
create a separate live platform webhook destination, and configure Connect
account/payout events at the implemented Connect endpoint. Test/live account IDs,
keys, and signing secrets are not interchangeable. Removing the hard-coded live
key guard is a future reviewed code change after those requirements pass; there
is no environment-variable shortcut to live charging in this version.

Connect webhook configuration is deliberately pending its API choice and handler:
the current `/api/webhooks/stripe` accepts platform Checkout events only and
rejects connected-account-scoped events. Do not send Connect events there. For a
v1 implementation the future handler would reconcile `account.updated` and
relevant `payout.*` events; for Accounts v2 choose the corresponding documented
thin account events and retrieve authoritative account state. Refund/dispute
events also need implemented handlers before subscription/launch. Use a separate
signing secret per destination; neither a Connect endpoint nor its env variable
exists yet.

## Validation

`npm run test:payments` uses Node 24's native TypeScript support, Stripe's SDK
signature verification, and the PGlite PostgreSQL runtime. It needs no API keys,
network access, or remote database. It applies the real migrations to a minimal
local Supabase Auth/role bootstrap. The only omitted extension statement is
`pgcrypto`, because `gen_random_uuid` is already present in this test runtime.
Tests cover exclusive/immutable reservations, auth and malformed input, delayed
payments, mismatch rejection, event replay, complete transaction rollback,
cancelled-order resale, role privileges, lost Stripe responses, binding failures,
stale reservations, and real signature tampering. PGlite runs one local database
connection; multi-connection contention and the actual Supabase gateway/RLS
deployment still require staging tests.

Validation results: **18/18 payment tests passed**, production build passed,
and ESLint passed for all five payment server/route files. The full repository
TypeScript check has **33 existing errors outside these files**, down from
43 at baseline; it is not a clean project-wide typecheck. Those unrelated user
files were left intact. The built public assets contain none of the payment
server implementation fingerprints checked during verification. Local HTTP
smoke checks confirmed that unconfigured Checkout returns 503 and an unsigned
Stripe webhook returns 400 through the actual TanStack routes.

## Work preservation

The checkout, webhook, database migrations, and environment example already
existed as untracked user work at the beginning of this review. Many UI and data
files also had uncommitted edits. This review preserves that work and does not
rewrite git history, commit, push, deploy, or run remote migrations.
