# 13 — Payment gateways: platform default and per-organization accounts

> As built. Supersedes the "mock adapter now, client POS later" framing in
> 01 §4.4, 03 §4, 09 §7 and 10 §8. Last verified against `734d305`.

## The one sentence

Every charge goes through `getPaymentProviderForOrg(orgId)`
(`src/lib/payments/index.ts`), which **prefers the organization's own encrypted
credentials and otherwise uses the platform default** — and if the org's
credentials exist but cannot be read, it **refuses** rather than falling back.

## 1. The seam

`PaymentProvider` (`src/lib/payments/provider.ts`) — `charge`, `createRecurring`,
`cancelRecurring`, `refund`, hosted-flow methods (`createHostedSale`,
`confirmTransaction`), `verifyWebhook`. Adapters:

| Adapter | File | Status |
|---|---|---|
| `StripeAdapter` | `src/lib/payments/stripe-adapter.ts` | **live** (production runs on it) |
| `WeVendAdapter` | `src/lib/payments/wevend-adapter.ts` | built, untested against a real terminal — blocked on a merchant ID |
| `MockAdapter` / `mock-hosted` | `src/lib/payments/mock-adapter.ts` | dev/demo only; **refused in production** by `src/lib/env.ts` because its webhook verifier accepts unsigned JSON |

`getPaymentProvider()` returns the platform adapter chosen by `PAYMENT_PROVIDER`
(`stripe` → `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`). Only the webhook route
and the per-org resolver call it directly; everything money-related goes through
the per-org resolver (the comment in `index.ts` says MUST, and means it — when the
public page asked the platform adapter whether it was hosted while the charge went
to the org adapter, the donor saw one flow and the money took another).

## 2. Per-organization credentials

Stored sealed in `Organization.posCredentialsRef` (AES-GCM via
`src/lib/crypto-box.ts`, key = `CREDENTIALS_KEY`; falls back to `AUTH_SECRET`
outside production, which is why `CREDENTIALS_KEY` is **mandatory** in production
— rotating `AUTH_SECRET` must never destroy every org's gateway credentials).

`src/lib/payments/org-credentials.ts`:

| Function | Does |
|---|---|
| `saveOrgGatewayCredentials(orgId, creds)` | seal + write; `creds` is `{ provider: "stripe", secretKey, webhookSecret? }` or the WeVend shape |
| `clearOrgGatewayCredentials(orgId)` | null the column |
| `loadOrgGatewayCredentials(orgId)` | `{ status: "none" } \| { status: "ok", creds } \| { status: "unreadable", reason }` |
| `describeOrgGatewayCredentials(orgId)` | **non-secret** summary for UI: `configured`, `provider`, `keyTail` (last 4), `liveMode`, or `error` |

Nothing ever returns, logs or audits the secret. The audit entry on connect is
`org.gateway.connected.stripe` with `after: { liveMode }` only.

### How an org connects (the only supported way)

`connectStripeAccount` in `src/app/(dashboard)/dashboard/actions.ts`, rendered by
`GatewayForm` (`src/components/dashboard/gateway-form.tsx`) in **Settings →
Payments** and in **onboarding step 4**. `requireOrgAdmin` — staff cannot
redirect a charity's money.

1. Shape check: `sk_(test|live)_[A-Za-z0-9]{10,}`; optional `whsec_[A-Za-z0-9]{10,}`.
2. **Live probe before storing**: `GET https://api.stripe.com/v1/balance` with the
   key. Rejected → nothing stored, field error. (Storing an unverified key means the
   org believes it is connected and finds out at a donor's declined card.)
2b. **Account country must be `CA`** (`GET /v1/account`, `src/lib/payments/stripe-account.ts`).
   A working key is not enough: the first production key was from an account registered
   in **India**, whose balance probe passed and whose every CAD Checkout then failed with
   "only registered Indian businesses … can accept international payments". Non-Canadian
   accounts are refused with that explanation. `/api/health` runs the same check on the
   **platform** key (`src/lib/payments/platform-health.ts`, cached 10 min) and reports 503.
3. `saveOrgGatewayCredentials` → `invalidateOrgProvider(orgId)` (drops the memoised
   adapter) → audit → `revalidatePath` for settings and dashboard.
4. The form clears the secret field on success — the UI promises the key is never
   shown again, so it must not stay in the DOM.

`disconnectGateway` clears and audits `org.gateway.disconnected`. Donations then
fall back to the platform account (the form's confirm dialog says so).

### The three states the product must show

`GatewayForm`, the onboarding done screen and the dashboard banner all render from
`describeOrgGatewayCredentials`:

| `status` | Shown as | Money goes |
|---|---|---|
| `none` | warning "No gateway connected — donations run on KindPath's platform account and do not settle to you" | platform account |
| `ok` | "Connected · Key ending xxxx · Test/Live mode" (+ test-mode caution) | the org's account |
| `unreadable` | destructive "credentials unreadable — donations are refused rather than falling back" | **nowhere** (charge throws) |

## 3. Test mode vs live mode

A `sk_test_` key connects and works end to end — 4242 4242 4242 4242 succeeds, a
receipt is issued, no money moves. Every surface that shows the connection shows
**Test mode** and says real donations need a live key. Production currently runs
the **platform** default on a sandbox key too (see `docs/15_GO_LIVE_RUNBOOK.md`);
before a real charity takes a real donation, either it connects its own live key
(the intended model) or the platform key is swapped for the platform's own live
account.

`src/lib/env.ts` also warns at boot when `STRIPE_SECRET_KEY` is a test key under
`NODE_ENV=production`.

## 4. Webhooks — platform and per-org

Endpoint: `POST /api/webhooks/pos` (`src/app/api/webhooks/pos/route.ts`).
Unauthenticated by nature — **the signature is the auth** — so it is rate limited
(60/min/IP), body-capped (64 KB), and every rejection is distinguished.

Subscribe exactly four events: `payment_intent.succeeded`,
`payment_intent.payment_failed`, `charge.refunded`, `refund.created`. Anything
else is acknowledged with 200 and ignored (`UnsupportedWebhookEvent`) — answering
400 would make Stripe back off and eventually disable the endpoint.

**Which secret verifies a payload?** `src/lib/payments/webhook-verify.ts`
(`verifyInboundWebhook`): the platform gateway first; on a signature mismatch,
the gateway of the org the payload refers to — `data.object.metadata.orgId` (KindPath
sets `metadata[orgId]` on every intent it creates), else the `Donation` row whose
`providerChargeRef` matches the payment-intent (refund/charge events carry no metadata). The org id is read from the *unverified* body only to choose a
key; nothing is trusted until a signature verifies. Before this helper existed a
refund issued from a charity's own Stripe dashboard was rejected and the receipt
stayed valid. Tests: `src/lib/payments/webhook-verify.test.ts`.

**Charges do not depend on webhooks.** The Stripe adapter confirms synchronously
(`confirm: "true"` on the intent; the hosted flow calls `confirmTransaction`), so a
donation is recorded and receipted on the spot. Webhooks handle the asynchronous
truths: a later failure, or a refund → `handlePaymentEvent`
(`src/lib/payment-events.ts`) voids the receipt. Idempotent via `webhook_events`.

Therefore an org that connects its own Stripe account **should** also add a
webhook endpoint in that account pointing at
`https://www.kind-path.org/api/webhooks/pos` with the four events, and paste its
signing secret into the optional field. Without it, donations still work; refunds
made in Stripe will not void KindPath receipts automatically.

## 5. Runbook

**Connect a charity's own Stripe account** — the charity does it themselves
(`docs/help/GETTING_STARTED.md` §4). Support can check the state in God Mode
(`/admin/organizations/[id]`) — it shows `keyTail`/`liveMode`, never the key.

**Swap test → live** — connect again with the live key ("Replace credentials");
the probe runs against live. Add/replace the webhook endpoint in Stripe's live
mode (test and live endpoints have **separate** `whsec_` values). Confirm the
status block reads *Live mode*.

**Disconnect** — clears credentials, audits, falls back to platform. Existing
receipts and history are untouched.

**Credentials unreadable** — means `CREDENTIALS_KEY` changed or the ciphertext was
damaged. Charges for that org throw until the admin reconnects; this is the
intended failure (a fallback would deposit the org's donations in a different
merchant account).

**WeVend** — `docs/11_INTEGRATIONS.md` §5 and `context.md`; not offered in the UI
until a merchant ID exists.
