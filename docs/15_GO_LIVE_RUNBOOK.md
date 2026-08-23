# 15 — Go-live runbook (what was actually done on 2026-08-22/23, and what to repeat)

> `docs/10_DEPLOYMENT.md` is the reference; this is the narrative of the real
> go-live of **www.kind-path.org**, the traps hit, and the checklist that remains
> before the first real charity. Keep it honest; delete items as they close.

## Where things stand

- Production is up: `GET https://www.kind-path.org/api/ready` → `{"ready":true}`.
- Apex `kind-path.org` 308s to `www` (canonical host settled at the edge).
- Payments: `PAYMENT_PROVIDER=stripe` with a **sandbox (test-mode) key** from a
  borrowed account as the platform default. **That account is registered in India and
  cannot take CAD — every donation on production currently fails at Checkout creation**
  ("The payment service is unavailable"). `/api/health` now reports it
  (`payments.ok=false, country=IN`). Fix = a Canadian Stripe account's key; see §2 and §6.
- Email: Resend, domain verified, region **ap-northeast-1 (Tokyo)** — see the
  residency caveat below.
- `/api/health` may report 503 with `billing.stale=true` on a fresh deploy. That is
  **correct**: the heartbeat has no row until the first 09:00 UTC cron run.

## 1. Resend (email)

1. Add the sending domain in Resend; it issues three DNS records (DKIM ×2 + SPF/MX
   as applicable). Add them at the registrar (GoDaddy here). Check with DNS-over-
   HTTPS, not the router's resolver — a local resolver lied about this domain once.
2. Click **Verify** on the *domain detail page* (click the domain name; the `···`
   menu on the list only offers Delete — deleting regenerates DKIM, don't).
3. Create an API key scoped to **Sending** only. A sending-scoped key answers
   `401 restricted_api_key` to "list domains" — that is the correct posture, prove
   sending instead by sending.
4. `EMAIL_FROM` must be on the verified domain.

**Region.** The domain was created in Tokyo and the decision was to keep it there
for now. Storage is Canadian (Neon `ca-central-1`), compute is `yul1`, but every
receipt email — which carries the donor's name and mailing address because the
CRA requires them on the receipt — transits ap-northeast-1. `docs/02_COMPLIANCE.md`
§3 says so. **Move the domain to a North American region before onboarding any
Quebec organization**, then delete that paragraph.

**Rotate** the Resend API key that was visible in a screenshot during setup, and
downgrade to Sending-only if it isn't already.

## 2. Payments — switching the platform to WeVend (decision 2026-08-23)

Stripe is being dropped as the platform default: the only account available was
India-registered and cannot take CAD, and the product's client gateway is WeVend. The
WeVend adapter is built and sandbox-verified; what it has always lacked is a **provisioned
merchant**. The owner now has a WeVend merchant account (mid + email + password + termId).

**Vercel → Production env (edit in place where the name exists):**

| Variable | Value |
|---|---|
| `PAYMENT_PROVIDER` | `wevend` |
| `WEVEND_BASE_URL` | `https://wepay.wevend.pro` (production) or `https://wepay.wevend.dev` (sandbox) — **must match the merchant account** |
| `WEVEND_IFRAME_URL` | `https://iframe.wevend.pro` / `https://iframe.wevend.dev` (same environment) |
| `WEVEND_MID` | the merchant ID the platform fallback transacts as |
| `WEVEND_TERM_ID` | terminal id (usually `00000003`) |
| `WEVEND_EMAIL` + `WEVEND_PASSWORD` | the merchant login (merchant mode); **or** `WEVEND_WV_NUMBER` + `WEVEND_PASSWORD` for ISV/org mode |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | can stay; ignored when provider is `wevend` |

Then redeploy and check:

```bash
curl -s https://www.kind-path.org/api/ready     # names any missing WEVEND_* var
curl -s https://www.kind-path.org/api/health    # payments: { provider:"wevend", ok:true, environment:"production"|"sandbox" }
```

`/api/health` authenticates as the platform merchant (`WeVendAdapter.probe()`), so a wrong
password or MID shows up there, not at the first donation. Webhook endpoint: none — WeVend has
no webhooks; `/api/webhooks/pos` answers 501 for it.

Each charity then connects **its own** WeVend merchant in Settings → Payments / onboarding step 4
(`docs/13_PAYMENT_GATEWAYS.md`). First real charge to prove: $5 on `/give/<slug>` → WeVend iframe →
return → receipt in a real inbox.

## 2a. Stripe (historical — what was done before the switch)

- A sandbox/test-mode account needs no business verification; that is how
  production was brought up without a KindPath Stripe account existing yet.
- **Never** put a live key from a different business into KindPath — live keys
  settle charity donations into *that* business's bank. The first screenshot
  offered exactly that; it was refused.
- Webhook: Developers → Webhooks → add destination → URL
  `https://www.kind-path.org/api/webhooks/pos` → **Snapshot** payload style →
  select exactly `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `charge.refunded`, `refund.created`. The "Selected events" tab is a review list,
  not a picker — use "All events" + search. Test and live endpoints have
  **separate** signing secrets; create the endpoint inside the sandbox.
- Verify the key with `GET /v1/balance` (expect `livemode:false` for a sandbox key) **and**
  `GET /v1/account` → `country` must be `CA`. The India-registered sandbox passed the first
  and failed every charge; the connect form and `/api/health` now check the second.

## 3. Vercel environment (Production)

All of `docs/10_DEPLOYMENT.md` §5 plus, because `PAYMENT_PROVIDER=stripe`:

| Variable | Note |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` or `sk_live_…`; shape is validated at boot |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` from the endpoint above; shape validated |

Traps hit:
- Pasting the literal placeholders `sk_test_…` / `whsec_…` from a chat message
  boots "ready" under presence-only checks and fails at the first donation.
  `src/lib/env.ts` now rejects anything not matching
  `sk_(test|live)_[A-Za-z0-9]{10,}` / `whsec_[A-Za-z0-9]{10,}` and says "a
  placeholder was probably pasted".
- `PAYMENT_PROVIDER` already existed (as `mock`) → "variable already exists";
  **edit in place**, don't add.
- `AUTH_SECRET` is set and **must not be rotated** (sessions + signed receipt
  links).

Loop until green:

```bash
curl -s https://www.kind-path.org/api/ready
```

then smoke:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://www.kind-path.org/give/st-marys
curl -s -o /dev/null -w '%{http_code}\n' https://www.kind-path.org/login/code
curl -s https://www.kind-path.org/api/health
```

## 4. Proving email

Two real sends went through `src/lib/email.ts` on the first day: a plain layout
test and an actual seeded CRA receipt (HMAC-signed PDF link). `sendEmail` returns
`simulated: true` only on the console fallback, which cannot run in production
(`RESEND_API_KEY` is required).

Still to prove once each from production (check Resend → Logs): verification
(signup), reset/invite, team invite, billing failure, campaign, contact form,
resend-failed. Open a production receipt link from a real inbox — a locally
signed link does not verify against production's `AUTH_SECRET`.

## 5. SEO / Search Console

Shipped: `metadataBase`, canonical, Open Graph + Twitter card, generated
`/opengraph-image` (1200×630), JSON-LD (`Organization` with
`alternateName: ["Kind Path", "kind-path", "KindPath Canada"]`, `WebSite`,
`SoftwareApplication` with offers read from `src/lib/plans.ts`), `sitemap.xml`
limited to rank-worthy pages (login/signup removed).

**User action:** Google Search Console → add property `kind-path.org` (domain
property; DNS TXT at GoDaddy) → submit `https://www.kind-path.org/sitemap.xml`.
If HTML-tag verification is preferred, add the token to `src/app/layout.tsx`
`metadata.verification.google`.

Expectation setting: the brand query "kindpath" is winnable in weeks; "kind path"
is two common words and depends on backlinks and time, not on code.

## 6. Before the first real charity — checklist

- [ ] The charity connects **its own** WeVend merchant in Settings → Payments (or onboarding
      step 4) — `docs/13_PAYMENT_GATEWAYS.md`.
- [ ] **Platform switched to WeVend** (§2): `PAYMENT_PROVIDER=wevend` + `WEVEND_*` set, redeployed,
      `/api/health` → `payments.ok:true`. Until then *no* donation on the site succeeds (the Stripe
      platform key is India-registered and cannot take CAD).
- [ ] First real WeVend charge proven end to end (`/give` → iframe → receipt in a real inbox).
- [ ] Resend domain moved to a North American region if the charity is in Quebec;
      `docs/02_COMPLIANCE.md` §3 updated.
- [ ] Resend API key rotated (screenshot exposure).
- [ ] `/api/health` green after the first cron run.
- [ ] One real-inbox receipt opened from production.
- [ ] WeVend sandbox ISV (`WV-ISV-50001`) still has no test merchant — ask WeVend for one + test cards if a sandbox walk is wanted before production.
