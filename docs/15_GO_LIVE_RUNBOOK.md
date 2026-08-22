# 15 — Go-live runbook (what was actually done on 2026-08-22/23, and what to repeat)

> `docs/10_DEPLOYMENT.md` is the reference; this is the narrative of the real
> go-live of **www.kind-path.org**, the traps hit, and the checklist that remains
> before the first real charity. Keep it honest; delete items as they close.

## Where things stand

- Production is up: `GET https://www.kind-path.org/api/ready` → `{"ready":true}`.
- Apex `kind-path.org` 308s to `www` (canonical host settled at the edge).
- Payments: `PAYMENT_PROVIDER=stripe` with a **sandbox (test-mode) key** from a
  borrowed account as the platform default — see "Before the first real charity".
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

## 2. Stripe

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
- Verify the key with `GET /v1/balance` (expect `livemode:false` for a sandbox key).

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

- [ ] The charity connects **its own live** Stripe key in Settings → Payments (or
      onboarding step 4) and adds the webhook endpoint in its live mode
      (`docs/13_PAYMENT_GATEWAYS.md` §4).
- [ ] Platform `STRIPE_SECRET_KEY` swapped from the borrowed sandbox key to
      KindPath's own account (live or test — it is only the fallback for orgs
      that skipped the gateway, and the dashboard tells them so).
- [ ] Resend domain moved to a North American region if the charity is in Quebec;
      `docs/02_COMPLIANCE.md` §3 updated.
- [ ] Resend API key rotated (screenshot exposure).
- [ ] `/api/health` green after the first cron run.
- [ ] One real-inbox receipt opened from production.
- [ ] WeVend: still blocked on the merchant ID (`WV-ISV-50001`); not offered in UI.
