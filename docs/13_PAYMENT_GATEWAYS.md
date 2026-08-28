# 13 — Payment gateways: platform default and per-organization accounts

> As built. Supersedes the "mock adapter now, client POS later" framing in
> 01 §4.4, 03 §4, 09 §7 and 10 §8. Last verified against `734d305`.

## Decision (2026-08-23): charities are offered **WeVend**; Stripe stays in the code, off the UI

`OFFERED_ORG_GATEWAY = "wevend"` in `src/lib/payments/offered.ts` decides which connect form
Settings → Payments and onboarding step 4 render. The Stripe adapter, `connectStripeAccount` and
its form remain (tested; works for Canadian Stripe accounts) and come back by flipping that one
constant. The platform default is being moved to WeVend too — see `docs/15_GO_LIVE_RUNBOOK.md` §2.

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
| `WeVendAdapter` | `src/lib/payments/wevend-adapter.ts` | **the offered gateway**; hosted-iframe flow, organization Global Token with per-org MID, recurring via `sale-with-token`, refund/void; sandbox auth + org-token semantics verified live; awaiting a provisioned merchant for the first real charge |
| `StripeAdapter` | `src/lib/payments/stripe-adapter.ts` | retained, not offered to orgs (see decision above); was the platform default until 2026-08-23 |
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

### Auth: the Organization Global Token (WeVend's documented default)

From WeVend's integration FAQ (`docs/vendor/WeVend_WePay_API_FAQ.html`):

> Payment endpoints accept either a merchant access token or an organization Global Token…
> **assume the Global Token feature will be enabled — default to using the organization
> global access token, not the individual merchant token.**

So the intended shape is: **KindPath authenticates once as the organization** (`POST
/api/auth/org-token` with `wvNumber` + `password`) and addresses each charity's merchant by
passing `mid` on every payment call. Confirmed live against the sandbox — omitting it answers:

```
GET /api/payments/get-transaction/x
{"statusCode":400,"message":"mid is required when using an organization token"}
```

Two consequences that are easy to get wrong:

- **`mid` is a query parameter on GETs**, not a header. `?mid=…` is accepted; `x-mid:` is not.
  `confirmTransaction` sends it always. Without it the confirmation fails **after the donor has
  paid** — money taken, no receipt — which is why it has its own regression test.
- **Organization login does not prove the merchant.** `/auth/org-token` succeeds for any MID,
  including a typo'd one, and the failure would land on a donor. `probe()` therefore follows
  login with a read-only `get-transaction/<impossible-id>?mid=…`: an unknown merchant answers
  401 *"Merchant not found or has been deleted"*, a real one answers something else. It
  validates the merchant while creating nothing.

### How an org connects — WeVend (what charities see)

`connectWeVendAccount` in `src/app/(dashboard)/dashboard/actions.ts`, rendered by `GatewayForm`
(`offered="wevend"`).

| Platform state | Fields asked | Auth used |
|---|---|---|
| Has organization credentials (`WEVEND_WV_NUMBER` + `WEVEND_PASSWORD`) — `platformHasOrgToken()` | **MID + Terminal ID only** | organization Global Token, `mid` per call |
| No organization credentials | MID + Terminal ID + **login email + password** | merchant token (`/auth/token`) |

The first row is the point: in the documented model **a charity never gives KindPath its WePay
password**, and nothing secret is stored for it — only `mid` + `termId`. `WeVendCredentials`
therefore has `password`/`email` optional, and *absence means "charge under the platform's
organization token"*.

`getPaymentProviderForOrg` picks the mode **explicitly** rather than by `??` fallback: an org
that supplied its own merchant login keeps using it even when the platform also has organization
credentials in the environment. Letting `wvNumber` fall through to env would silently move such
an org onto the platform's token.

1. Requires WeVend enabled (`WEVEND_BASE_URL` + `WEVEND_IFRAME_URL`).
2. **Probe before storing** (above).
3. `saveOrgGatewayCredentials` → `invalidateOrgProvider` → audit
   `org.gateway.connected.wevend` with `{ midTail, environment, auth: "organization" | "merchant" }`
   → revalidate.
4. **Environment is platform-wide.** Per-org credentials don't carry a host; `WEVEND_BASE_URL`
   does. The form, the status block and the done screen say *Sandbox* / *Production*
   (`wevendEnvironment()`), because a production merchant on a sandbox-pointed platform
   "connects" and then fails at the first gift.

### Getting a merchant provisioned

`/api/merchants/admin/register` is **admin-only** — a merchant cannot be self-registered. Per the
FAQ the sequence is: KindPath gives WeVend the email for the claim; WeVend registers the merchant
and issues **MID + termId**; the contact receives a claim email with a registration code and sets
a password; that MID is what the charity then enters in KindPath.

Note the FAQ says test merchants are registered in **US country** — and the card-entry iframe is
region-specific (below). A US-registered test merchant with the Canadian iframe host is a
plausible source of a confusing first failure.

### Card-entry iframe hosts (v3.2.2 p.125)

| Region | Dev | Production |
|---|---|---|
| Canada | `iframe.wevend.dev` | `iframe.wevend.pro` |
| US | `iframe-us.wevend.dev` | `iframe-us.wevend.pro` |

Set by `WEVEND_IFRAME_URL`; it must match the merchant's region **and** the API environment.

### Test cards (sandbox)

Verified working end to end against MID `RCTST0000048568` / TID `00000002` on 2026-08-28.

| Scenario | PAN | Expiry |
|---|---|---|
| Approved | `4111 1111 1111 1111` | any future date |
| Expired card | any PAN | any past date, e.g. `01/2020` |

No other decline scenarios are provisioned; request them from WeVend if needed.

### Void vs refund, and the refund gap

**WeVend's answers (2026-08-28):** `orderId` on a refund must be **the original sale's**
(the gateway issues its own id for the refund itself); **as a matter of policy refunds should
be issued through WeCenter, not the API**; there is **no refund webhook**, and refunds are
viewed in WeCenter. They offered to build a "refund receipt" feature — worth noting that this
would not close our gap, which is *detection*, not paperwork: we need to know a refund happened
so the CRA receipt can be voided.

Consequence for the code: `WeVendAdapter.refund()` sends a fresh `orderId` and is therefore
wrong, and cannot be corrected without first persisting the sale's `orderId` (it is generated
inside `beginHostedSale` and never stored). Marked as such in the adapter.

| Stage | Available |
|---|---|
| Sale / Pre-Auth, not settled | **Void** — `POST /api/payments/void`, `transactionId` only |
| Completed / captured | **Refund only** — `POST /api/payments/refund-with-token` (`amount`, `orderId`, `mid`, `termId`, `transactionId`, `redirectUrl`); partial amounts supported |
| Dispute / chargeback | not covered by this API |

`confirmTransaction` calls `mark-transaction-complete` on approval, so **a KindPath donation is a
Completion almost immediately and can no longer be voided** — refund is the only route.
`voidTransaction` remains for the pre-settlement case (e.g. an AVS failure).

> ⚠️ **KindPath has no refund feature today.** Nothing calls `provider.refund()`; the only path
> that ever voided a receipt automatically was the *Stripe* webhook (`handlePaymentEvent`).
> **WeVend has no webhooks at all**, so a refund issued in the WeVend merchant portal is invisible
> to KindPath and the tax receipt stays valid — a receipt for money that was given back, which is
> a CRA problem, not a cosmetic one. Until a refund action exists, the manual procedure is:
> refund in the WeVend portal, then **void the receipt** in KindPath (`voidReceipt`, Receipts →
> the receipt → Void). Closing this properly means one action that calls `refund()` and voids the
> receipt in the same transaction.

### Decline messages

`src/lib/payments/wevend-response-codes.ts` carries all 325 Fiserv codes from the FAQ appendix.
Two functions, deliberately different: `describeResponseCode()` is the raw meaning (logs, support,
recurring-charge failures staff read) and `donorMessage()` is what a **payer** may be told.
Fraud and security codes — 102 "Suspected fraud", 129 "Suspected counterfeit card", 122 "Security
violation" — collapse into a generic decline: repeating them coaches card testing and is not ours
to disclose. Codes that mean the *organization's* setup is broken (109 invalid merchant, 130
invalid terminal, 150 invalid merchant set up) say so, because a donor retrying another card will
never fix those.

### How an org connects — Stripe (retained, not offered)

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
