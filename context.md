# KindPath — Project Context (handoff)

> Continuation context so work can resume in a fresh chat. Written 2026-07-01; **"Since 2026-08-22" section added 2026-08-23** — read it first, it supersedes older bullets where they conflict. `CHANGELOG.md` has the dated list.
> Owner: Dhruv Dingra / Rytful Media. User building it: yashforcap@gmail.com.

## What this is
**KindPath** — a multi-tenant SaaS "money + members + CRA-compliant-receipts engine for Canadian
community organizations" (temples, churches, mosques, non-profits). Comparable to Pushpay /
CanadaHelps / Tithe.ly. Donations were the first flow; it now also does memberships, event
ticketing, pledges, campaigns, and has an in-dashboard AI assistant.

Full design/planning docs live in **`docs/`** (README + 01–11). Read `docs/README.md` first.

## Critical domain rule (do not forget)
The donor-facing "invoice" is legally an **Official Donation Receipt** (CRA Income Tax Reg. 3501),
NOT a commercial invoice. Only **registered charities** issue official receipts; **non-registered**
orgs issue **payment confirmations**. Split-receipting: `eligibleAmount = amount − advantageValue`
(the advantage = value the donor got back, e.g. a gala dinner). This is enforced throughout.

---

## Tech stack
- **Next.js 14.2.5** App Router + TypeScript + **Tailwind 3.4** (token-driven design system in
  `src/app/globals.css` + `tailwind.config.ts`; brand = **teal `#1F7A6D`** since the Aug reskin (was indigo —
  `src/lib/brand.ts` is the one hand-mirrored hex), Sora display + Inter body; surface scopes per docs/08).
- **PostgreSQL 16** in Docker (container `kindpath-pg`, host port **5433**) + **Prisma 6.19.3**.
- **Auth**: custom JWT (jose HS256) single httpOnly cookie `kindpath_session` with a `kind` claim
  (`platform` | `org` | `donor` | `volunteer`); bcrypt passwords. NOT NextAuth. **2FA (TOTP)** for org
  users: RFC 6238 implemented on Node crypto in `src/lib/auth/totp.ts` (no dep; base32, HOTP/TOTP,
  ±1-step window, otpauth URL, recovery codes); login issues a short-lived `kindpath_2fa` ticket cookie
  (`twofa-ticket.ts`) → `/login/2fa` challenge → full session. Enable/disable at `/dashboard/security`
  (QR enrol + 10 one-time recovery codes, hashed). Tested vs RFC vectors + full login/challenge flow.
- **PDF**: `@react-pdf/renderer`. **QR**: `qrcode`. **Email**: Resend HTTP API (console fallback in dev).
- Tests: **vitest** (`npm test`, 196 passing as of 2026-08-23).

## Multi-tenancy + security (the important part)
- **Two Prisma clients** in `src/lib/db.ts`: `db` (role `kindpath_app`, non-superuser, **RLS ENFORCED**,
  used at runtime via `withTenant`) and `adminDb` (superuser, bypasses RLS — auth lookups, platform/global
  ops, seeding, cron/webhooks only).
- **`withTenant(orgId, cb)`** (`src/lib/tenant.ts`) runs a transaction that `SET LOCAL app.current_org_id`
  → Postgres RLS scopes every tenant query. Policies in `prisma/sql/rls.sql` (idempotent; re-run with
  `npm run db:rls`). Verified: app role sees 0 rows without context, only its org's rows with it.
- **RLS is CATALOG-DRIVEN and enforced in the pipeline** (2026-07-14). `rls.sql` no longer hardcodes a
  table list — it discovers every table with an `org_id` column from `pg_class`/`pg_attribute`, so a new
  tenant table CANNOT ship without isolation. `organizations` is special-cased (keys on `id`);
  `platform_admins`/`webhook_events`/`_prisma_migrations` are global by design.
  **`npm run db:deploy` = migrate deploy → db:rls → db:verify-rls**, so policies can never lag a migration.
  `scripts/verify-rls.ts` asserts the invariant (catalog check + live "app role sees 0 rows" probe) and
  **exits 1** on any violation — wire it into CI. PRODUCTION AUDITED + VERIFIED on Neon: all 20 tenant
  tables FORCE RLS + policy, zero cross-tenant visibility, admin role bypasses correctly (login safe).
  Safety net proven by injecting an unprotected `org_id` table: verifier caught the missing policy AND a
  real 1-row leak (exit 1), `db:rls` auto-protected it, exit 0. No hand-maintained list to forget.
- **Auth guards** `src/lib/auth/guards.ts`: `requireOrgUser`, `requireOrgAdmin` (role=org_admin),
  `requirePlatformAdmin`, `requireDonor`. Middleware (`src/middleware.ts`) protects `/admin` `/dashboard`
  `/portal` and redirects by role.
- **Security hardening done** (UPDATE 8–9 in memory): signed **charge token** (`src/lib/charge-token.ts`)
  so donation amount can't be tampered client-side; **email HTML escaping** (`escapeHtml`); **security
  headers + CSP** in `next.config.mjs` (script-src 'self' 'unsafe-inline' — nonce-CSP was tried and
  REVERTED because it breaks Next static pages); **signed receipt links** (`src/lib/receipt-links.ts`) —
  `/r/[id]` + PDF need a token or owning session; **rate limiting** (`src/lib/rate-limit.ts`, async,
  Upstash-Redis-optional + in-memory fallback) on login/signup/charge/contact/campaign; **input bounds**
  (amount cap $1M, max lengths); constant-time cron secret; env validation (`src/lib/env.ts`).

## We Vend WePay integration (spec v2.2.0 — adapter scaffolded, needs sandbox creds)
`WeVendAdapter` (`src/lib/payments/wevend-adapter.ts`) + interface extension for the **hosted-iframe
flow** (WeVend captures cards in its own iframe, not server-side): `provider.ts` adds optional
`beginHostedSale` / `confirmTransaction` / `voidTransaction` + `supportsHostedSale()` guard; types add
`HostedSaleInput`/`HostedSaleInit`/`ConfirmResult`. Adapter: JWT auth (`/auth/token`, 7-day token
cached, re-auth on 401), `beginHostedSale`→`/payments/sale`→`{paymentOrderId, iframe URL}`,
`confirmTransaction`→`/payments/get-transaction/:id` (respCode 000=approved), `charge`→
`/payments/sale-with-token` (SYNCHRONOUS — recurring/cron path, providerToken = an initial sale's
transactionId), `refund`→`/payments/refund-with-token`, `voidTransaction`→`/payments/void`. Amounts in
**cents as strings**, orderId **≤15 chars**. No webhooks — reconcile via return URL + polling.
Env `WEVEND_BASE_URL/IFRAME_URL/MID/TERM_ID` + auth: **org/ISV mode** (`WEVEND_WV_NUMBER`+`WEVEND_PASSWORD`
→ `/api/auth/org-token`, one token acts across many merchant MIDs, `mid` passed per call) OR merchant
mode (`WEVEND_EMAIL`+`WEVEND_PASSWORD` → `/api/auth/token`). 12 unit tests. **SANDBOX VERIFIED LIVE**
(2026-07-14): base `https://wepay.wevend.dev`, dev ISV creds `WV-ISV-50001`/`password123` →
adapter authenticates + reaches /payments/sale for real (fails only on "Merchant not found" — no test
merchant provisioned under the ISV yet; register needs admin role → 403). BLOCKED on WeVend/Dhruv:
a provisioned test `mid`+`termId` under WV-ISV-50001, and test card numbers for the iframe.

**Hosted redirect flow (BUILT + E2E-verified via mock-hosted)**: `/give` in hosted mode →
`beginHostedDonation` action (validates, `provider.beginHostedSale`, signed **state cookie**
`kindpath_hs` (`src/lib/hosted-state.ts`, HMAC, 30-min) carries amount/org/fund across the off-site
hop) → donor pays on gateway page → returns to **`/give/[slug]/response`** which NEVER trusts the
redirect's success flag: verifies state cookie + paymentOrderId match, `confirmTransaction`
server-side, then issues the signed chargeToken → `HostedDetailsForm` → existing `completeDonation` →
receipt. The donation's `providerChargeRef` = gateway transactionId = the reusable token for recurring
`sale-with-token`. **`PAYMENT_PROVIDER=mock-hosted`** simulates the whole thing locally: MockAdapter
hosted mode + `/mock-gateway/[paymentOrderId]` fake card page (badged SIMULATED, only served in
mock-hosted). Verified: all 4 response branches (approved / declined / order-mismatch / missing
cookie) + full order→gateway→confirm→details→receipt pipeline (DB-checked). 72 tests total.
**Per-org merchant credentials (BUILT + verified)**: God Mode → org → Settings → "Payment gateway
(WeVend merchant)" card saves mid/email/password/termId **encrypted at rest** — AES-256-GCM sealed blob
in `Organization.posCredentialsRef` (`src/lib/crypto-box.ts`, HKDF key from `CREDENTIALS_KEY` ??
`AUTH_SECRET` — set a dedicated `CREDENTIALS_KEY` in prod; `src/lib/payments/org-credentials.ts`
save/load/describe). `getPaymentProviderForOrg(orgId)` (payments/index.ts) builds a per-org
WeVendAdapter from decrypted creds (cached per orgId, `invalidateOrgProvider` on change), env-merchant
fallback; non-wevend providers return the singleton. Call sites now org-aware: give actions, hosted
response page, billing `settleDuePlan`. Verified: save via real God-Mode action → DB holds `v1.` sealed
blob (plaintext-leak check false), decrypt round-trips, resolver uses org MID over env fallback; 5
crypto-box unit tests (round-trip, random IV, GCM tamper, wrong key, malformed). 77 tests total.
**Still needed to go live**: sandbox baseUrl + test merchant creds + test cards (verify adapter against
real gateway); recurring-signup initial hosted sale to capture the token; decide webhook-less refund
reconciliation.

## Payment abstraction (client will plug in their POS "We Vend" later)
> **Superseded in part** — see "Since 2026-08-22" below and `docs/13_PAYMENT_GATEWAYS.md`: Stripe is live in production, orgs connect their OWN Stripe accounts, and inbound webhooks verify per org.

`src/lib/payments/`: `PaymentProvider` interface + `MockAdapter` (charges ending `.01` decline) +
**`StripeAdapter`** (`stripe-adapter.ts`, raw REST via fetch, no SDK dep: PaymentIntents w/ idempotency
keys, composite `cus|pm` tokens for stored methods, refunds by intent, HMAC-verified webhooks w/ replay
tolerance; test-mode-only bridge maps the giving page's `tok_public_oneoff` → `pm_card_visa` so the flow
works before Stripe Elements is wired into the frontend) + `getPaymentProvider()` factory (switch on
`PAYMENT_PROVIDER` env: `mock` | `stripe`). Env: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
(prod-required when provider=stripe, see `env.ts`). Swapping in the real We Vend POS =
one adapter file, no other changes. Giving page has a "POS (We Vend) mode" link (`?pos=wevend`).

---

## Feature inventory (all built + verified)
**Self-serve onboarding** (`/dashboard/onboarding`, org_admin-only, 3 steps server-action-driven via
`?step=`): 1) org profile — charity status, BN/RR (validated `^\d{9}RR\d{4}$` when registered),
signatory, address (receiptLocality derived from city+province); 2) branding (color/logo/receipt msg,
skippable); 3) plan picker (`src/lib/plans.ts` = single source of pricing: starter $29 / community $59 /
enterprise $199 monthly, annual = 10× "2 months free") → sets `Organization.onboardedAt` (migration
`add_onboarded_at`). Signup now redirects here; dashboard shows a "Finish setting up" banner until done;
seeded + admin-created… seed sets onboardedAt (admin-created orgs intentionally DON'T → their new admin
gets the wizard). Verified end-to-end via no-JS server-action POSTs (curl) + DB checks + UI screenshots.

**Public**: marketing landing (`/`, animated: scroll-reveal journey, count-up, interactive hero, FAQ
accordion), `/contact` (Book a demo form), `/login`, `/signup`, `/give/[slug]` (donation flow:
amount+fund+frequency → mock pay → name+address → receipt; cover-the-fees toggle), `/c/[slug]/[campaign]`
(campaign page), `/join/[slug]` (membership), `/e/[slug]/[eventSlug]` (event tickets), `/r/[id]`
(receipt success, token-gated).

**Org dashboard** (`/dashboard/*`): Overview, Giving page & QR (+ POS We Vend mode), Donors (+ `[id]`
detail w/ edit+notes), Recurring plans (+ org pause/resume/cancel), Funds (+create), Campaigns (+`[id]`
detail, create, close), **Pledges** (record/fulfill/cancel + totals), **Memberships** (plans + members
roster), **Events** (create + ticket types + registrations), Receipts (+ **annual consolidated
generate**, void, PDF), Reports (12-mo trend, top donors, **CSV exports** `/api/export/[type]`),
Communications (**CASL-gated campaign composer** w/ segments), **AI assistant** (`/dashboard/assistant`),
**Team** (invite/roles/disable, org_admin-only), **Security** (2FA/TOTP enrol + recovery codes), Settings (org + **white-label branding**: logo URL +
brand color + receipt message/footer/**serial prefix**).

**Volunteers** (feature key `volunteers`, community+enterprise): `/dashboard/volunteers` — roster
(add w/ temp password `ChangeMe123!`, activate/deactivate, reset pw), **pass issuance** (title +
optional expiry → serial `VP-<year>-<hex>`), revoke. **Volunteer login** = 4th session kind
(`volunteer`, same `/login` form; jwt/middleware/guards extended; portal prefix `/volunteer`).
**Volunteer portal** `/volunteer`: pass cards w/ **QR codes** (encode signed URL) + profile w/
password change (rate-limited). **Public verification page `/vp/[id]?t=`** (target of the QR,
`src/lib/pass-links.ts` HMAC domain-separated from receipt tokens, 404 on missing/tampered token):
VALID / REVOKED / EXPIRED / INACTIVE VOLUNTEER for door staff. Tables `volunteers` +
`volunteer_passes` under RLS (verified 0 rows w/o tenant ctx). Seed volunteer: grace@example.com.

**Donor portal** (`/portal/*`): overview, history, recurring (pause/cancel + **dunning: past-due/
suspended plans show a red attention banner + "Payment failed" badge + one-click "Retry payment"**),
payment methods, receipts, profile (+CASL toggles). Dunning recovery reuses `settleDuePlan()` (extracted
from the billing cron) via `retryPlanForDonor()` — ownership-checked, rate-limited (5/min), and uses a
unique idempotency key so a real gateway genuinely re-charges instead of replaying the last decline.

**Platform super-admin / God Mode** (`/admin/*`): overview, organizations (create/suspend/impersonate)
+ per-org hub `/admin/organizations/[id]` (overview, donors, receipts, funds, recurring, subscription
management, **feature entitlements toggle**, users, settings), subscriptions, analytics, support
(audit log + **Run billing now**).

**Background**: recurring **billing cron** `/api/cron/billing` (CRON_SECRET; retries 3/5/7 then suspend;
issues receipts + branded emails), **refund→void webhook** `/api/webhooks/pos` (idempotent), `/api/health`
(**enriched**: dbLatencyMs + release + env), `robots.ts`, `sitemap.ts`.

**Observability** (`src/lib/observability.ts`, zero-dep, env-gated): `log(level,msg,fields)` one-line
JSON (Vercel log drains); `captureError(err,ctx)` always structured-logs AND, when **`SENTRY_DSN`** set,
fire-and-forgets to Sentry's store API over plain HTTP (DSN parsed, X-Sentry-Auth header — swap in the
real SDK later, call sites unchanged; never throws). Client boundaries (`error.tsx`/`global-error.tsx`)
POST to **`/api/monitoring`** (no auth by design, 10/min rate-limited, size-capped) → captureError with
source=client-boundary. Wired into: cron billing catch (visible failed runs), webhook processing catch,
beginHostedDonation catch, health check. 8 unit tests (DSN parse, event shape, no-DSN no-fetch,
DSN→store POST, never-throws, log routing). 85 tests total. Verified live: health JSON, monitoring 204
+ structured log lines, 429 after 10/min.

**Kiosk mode** (`/kiosk/[slug]`, `qr`-feature-gated, noindex): full-screen self-serve giving for
tablets — big amount preset buttons ($20–$1000), fund picker, in-page flow (amount → pay → minimal
receipt details → "Thank you" → **auto-reset 12s**, no PII left on the shared screen; receipt emailed).
`completeDonation` refactored to share `recordDonation()` core with a new redirect-free
`completeKioskDonation` action. Synchronous providers (mock/stripe) do the full in-page flow; hosted
(WeVend) hands off to the gateway page then `/response` (hosted-kiosk auto-reset is a follow-up).
"Launch kiosk" link on the giving dashboard. Verified E2E: $50 → official receipt issued, no PII shown,
`qr`-revoked → 404. (Text-to-give deferred — needs Twilio, not configured.)

**White-label (complete end-to-end)**: donation/campaign pages retint from org `primaryColor` + show
`logoUrl` (`src/components/give/branded.tsx`, hex→HSL in utils); **receipt PDF** uses org color + logo +
custom message/footer + serial prefix (`src/lib/pdf/receipt-document.tsx`); **all emails** branded via
`emailLayout({brand})`. **Logo file upload** (Settings → Branding): `LogoUploader` → `uploadLogo`
server action → storage seam `src/lib/storage/` (`getStorage()`; default `DataUriStorage` encodes to a
`data:` URI — no bucket, works under CSP `img-src data:` + in the receipt PDF; swap `STORAGE_PROVIDER=s3`
later). `validateImage` (magic-byte sniff, PNG/JPG/WebP only — SVG rejected, 256 KB cap). `logoUrl` is
now owned solely by the logo actions (removed from `updateOrgSettings` so a settings save can't wipe it).
Onboarding step 2 still takes a logo URL. Caveat: data-URI logos may be stripped by some email clients.

**Feature entitlements** (`src/lib/features.ts`): plan baseline ⊕ per-org overrides. Keys: qr, recurring,
funds, campaigns, memberships, events, receipts, annual_receipts, reports, communications, sms, assistant,
api. Super-admin toggles them; org nav hides + `assertFeature()` (`src/lib/access.ts`) page-guards; access
revoked (suspended org / cancelled sub) shows a lock screen.

**AI assistant** (`src/lib/assistant/` + `/api/assistant` + `/dashboard/assistant`): tenant-scoped,
in-dashboard only, limited. Tools: search_donors, donor_summary, org_stats, find_receipt, lapsed_donors,
recent_donations, **create_draft_campaign** (safe/reversible), **export_csv**. Uses Claude API when
`ANTHROPIC_API_KEY` set (tool-use loop); otherwise a deterministic basic-mode intent router. Cannot
publish/send/charge/delete.

---

## Running it locally
```bash
docker start kindpath-pg          # if Docker was off, start Docker Desktop first
npm run dev                       # http://localhost:3000
```
DB scripts: `npm run db:migrate` (admin url), `npm run db:rls`, `npm run db:seed`, `npm run db:studio`,
`npm test`.

**GOTCHAs (learned the hard way):**
- Running `npm run build` (production) **clobbers the running `next dev` server's `.next`** → CSS/JS 404s /
  unstyled page. Always **stop the preview, build, then restart** it. For quick type checks use
  `npx tsc --noEmit` (doesn't touch `.next`).
- After a **Prisma schema change + `prisma generate`**, **restart the dev server** so it loads the new client.
- The Claude Preview browser tab runs `document.visibilityState="hidden"` → `requestAnimationFrame`, scroll
  events, and IntersectionObserver are **paused there**, so scroll/count-up/reveal animations can't be
  screenshot-verified (verify via DOM instead). `preview_eval` reads right after `.click()` are stale
  (await ~300–400ms). Use `document.scrollingElement.scrollTop`, not `window.scrollTo`.
- `UID` is a readonly var in zsh — don't use it in bash scripts.
- Browser UI login gets rate-limited during automated testing (10/min). For verification, mint a session
  JWT directly with `AUTH_SECRET` and set the `kindpath_session` cookie via curl.
- **The Claude Preview browser strips cookies from ALL non-GET requests** (fetch AND form-POST
  navigations), so server actions can never be click-executed there — they always bounce to /login.
  To verify a server action end-to-end: curl the page with the session cookie, extract the form's
  `$ACTION_*` hidden fields from the HTML, then POST them multipart (no `Next-Action` header — the
  no-JS progressive-enhancement path) with the form fields + cookie; expect 303 + check the DB.
  It also silently DROPS the JS-set `kindpath_session` cookie after failed POSTs — re-set before each nav.

## Seeded logins (password for all: `Password123!`)
| Role | Email | Portal |
|------|-------|--------|
| Platform super admin | `admin@kindpath.app` | `/admin` |
| Org admin (registered charity, St. Mary's) | `jane@stmarys.org` | `/dashboard` |
| Org admin (non-registered, Riverside Mosque) | `admin@riverside.org` | `/dashboard` |
| Donor | `aanya@example.com` | `/portal` |
| Volunteer (St. Mary's) | `grace@example.com` | `/volunteer` |

Newly-created org admins / password resets get temp password **`ChangeMe123!`**.
St. Mary's has demo white-label branding set (teal `#0d9488`, logo, custom receipt msg/footer,
`STM-` serial prefix) + 2 demo pledges — `npm run db:seed` resets all demo data.

## Env vars (`.env`, see `.env.example`)
`DATABASE_URL` (app role, RLS), `ADMIN_DATABASE_URL` (superuser), `AUTH_SECRET`, `AUTH_COOKIE`,
`NEXT_PUBLIC_APP_URL`, `EMAIL_FROM`, `PAYMENT_PROVIDER`, `CRON_SECRET`, `CONTACT_TO`,
optional `UPSTASH_REDIS_REST_URL`/`_TOKEN` (distributed rate limit — the in-memory fallback is a
**no-op on serverless**, so set these in prod), `SENTRY_DSN`, `KINDPATH_GST_NUMBER` (printed on
subscription invoices), and (not yet set) `ANTHROPIC_API_KEY` for full AI chat.

**Hard production requirements** (`src/lib/env.ts` throws on first real request if missing):
`ADMIN_DATABASE_URL`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `RESEND_API_KEY`, `CREDENTIALS_KEY`.
`RESEND_API_KEY` is required because `sendEmail` otherwise falls back to console logging and every
receipt would be recorded as delivered while nothing sends. `CREDENTIALS_KEY` is required because it
otherwise falls back to `AUTH_SECRET`, which would couple credential decryption to session signing —
rotating `AUTH_SECRET` would destroy every org's stored gateway credentials and invalidate every
receipt link already emailed to a donor.

## Deploy (see docs/10_DEPLOYMENT.md)
Recommended: **Vercel** + **Neon Postgres (ca-central-1)** + **Resend**. Two DB roles (create
`kindpath_app` non-superuser; run migrations as owner). `vercel.json` has the daily billing cron.
`scripts/create-admin.ts` creates a real prod super-admin (don't seed demo data in prod). `build` runs
`prisma generate && next build`; `postinstall` runs `prisma generate`.

## Production hardening pass (2026-08-06) — what changed and why

Executed against the approved plan in `~/.claude/plans/peaceful-wondering-snowflake.md`.

**Money safety**
- **Notification outbox** (`src/lib/notifications.ts`). `queue*Email(tx, …)` writes a `notifications`
  row inside the transaction; `flushEmails([...])` delivers AFTER commit. Sending inside `withTenant`
  held a lock on `receipt_sequences` across an HTTPS call to Resend under a 5s timeout, so a slow mail
  provider could roll back a gift that had already been charged. **Never call `sendEmail` inside a
  transaction.**
- **`Donation.chargeKey`** — unique, set ONLY on succeeded donations (nulls don't collide in Postgres).
  This is the real double-submit guard; the in-transaction "already exists?" read is only a fast path.
  On P2002 the writer returns the winning request's receipt (`src/lib/donations.ts`).
- `recordDonationSafely` never shows a charged donor a generic error page.
- Billing cron: per-plan try/catch, and batching that tracks handled ids rather than using offsets
  (settled plans leave the result set, so `skip` would silently skip rows).

**Auth** — sessions carry `v` (token version) re-checked on EVERY request via
`src/lib/auth/revocation.ts` → `getSessionStatus()`. Disabling a user, suspending an org, demoting a
role, or resetting a password now takes effect immediately instead of after 7 days. Shared
`ChangeMe123!` is gone: accounts are created with an unusable random hash + `mustChangePassword`, and
the invitee sets their own password via a single-use SHA-256-hashed expiring link
(`src/lib/auth/invite.ts`, `password-reset.ts`). Per-account lockout in `src/lib/auth/lockout.ts`.

**Revenue** (`src/lib/subscriptions.ts`, `src/lib/tax.ts`) — trial expiry, `past_due` with a 14-day
grace countdown, province-based GST/HST, sequential `KP-<year>-<n>` invoice numbers, invoice PDF,
`/dashboard/billing`, `/admin/revenue`. **Deliberate policy: a lapsed subscription locks the dashboard
but never blocks donors and never deletes records.** `assertBillingActive` gates only actions that
create NEW obligations (manual donation entry, annual receipt generation).

**CRA** — `generateAnnualReceipts` excludes gifts that already carry a receipt (`receipt: { is: null }`)
and honours `receiptMode`; voided/replaced receipts render VOID on the PDF; `reissueReceipt` uses
`Receipt.replacesSerial`; issue/void/export are audit-logged via `src/lib/audit.ts`.

**CI** (`.github/workflows/ci.yml`) — typecheck, tests, a build that must succeed WITHOUT runtime
secrets, and a real cross-tenant RLS test against a live Postgres. `REQUIRE_TENANT_DATA=1` makes
`verify-rls.ts` fail rather than pass vacuously on an empty database.

**UI honesty** — removed the fake card forms (number/expiry/CVC pre-filled `4242…` plus Apple/Google
Pay buttons) that collected and charged nothing on public org-branded pages. Saved payment methods now
show the gateway's actual card or nothing, never a hardcoded "Visa •••• 4242".

**Shared primitives added** — `FormAlert` (role="alert"), `ConfirmDialog`/`ConfirmButton` (replaces
`window.confirm`/`prompt`/`alert`, which some webviews suppress entirely so destructive actions
silently no-op'd), `Field` (aria-invalid + aria-describedby), `Skeleton`/`PageSkeleton`,
`SectionError`, `ListSearch`/`Pagination`, `src/lib/validation.ts` (all field errors, not `issues[0]`).

## NOT built yet / honest caveats
- **Real payments**: Stripe adapter is **live in production** (platform default on a borrowed *sandbox* key — must be swapped before a real charity; see docs/15 §6). Hosted Checkout flow is what the giving page uses; the frontend still lacks **Stripe Elements** for the in-app card step, so the non-hosted one-off path relies on the test-mode `pm_card_visa` bridge. **We Vend POS adapter** still needs API docs +
  sandbox/prod keys + webhook secret. `/give`'s "POS (We Vend) mode" is a labelled link, not yet wired.
- **AI chat** needs `ANTHROPIC_API_KEY` (falls back to deterministic basic-mode without it).
- **Email** is live via Resend in production (domain in **ap-northeast-1** — move before any Quebec org; docs/02 §3). Console fallback in dev.
- **`sendCampaign` still sends in-request** (now queued-first and resumable, but a large send can still
  exceed the Vercel function limit). Move to a queue/cron before a big list.
- Donor self-service data export + anonymization (PIPEDA/Law 25) not built; org-level CSV export exists.
- Pagination added to donors + recurring only. `listReceipts`, `segments.ts`, `queries/admin.ts` and the
  CSV exporter still load everything.
- Not done: nonce-CSP (incompatible w/ static pages), object storage for logos (upload works via a
  data-URI fallback; wire S3/R2 for large assets + email-safe hosted URLs), recurring event series,
  pledge→payment auto-linking, donor tags/saved segments,
  real SMS (Twilio/MSG91), lawyer review of receipt template + per-org
  BN/RR before issuing real official receipts, Neon PITR + a **tested** restore.
- `/privacy` and `/terms` exist but are explicitly marked **drafts pending counsel** on the page itself.

## Since 2026-08-22 — go-live, passwordless, org gateways, onboarding (read first)
- **Production is live at https://www.kind-path.org** (`/api/ready` → `{"ready":true}`; apex 308s to www). Vercel `yul1`,
  Neon `ca-central-1`, Resend (Tokyo region — residency caveat in docs/02 §3), Stripe **sandbox** key as the platform
  default (borrowed account; swap before the first real charity — docs/15 §6). `/api/health` 503 `billing.stale` is
  expected until the first 09:00 UTC cron. **Never rotate `AUTH_SECRET`** (sessions + signed receipt links).
- **Passwordless email sign-in** for donors/volunteers at `/login/code` (`LoginCode` model, `src/lib/auth/login-code.ts`):
  keyed by email → account chooser; 10-min TTL; 5 attempts counted on the row because `rateLimit()` fails open;
  enumeration-safe. Staff keep password + TOTP. Firebase Auth was considered and rejected (email is unique per org). docs/14.
- **Organizations connect their own Stripe account** (Settings → Payments and onboarding step 4): `connectStripeAccount`
  probes `/v1/balance` before storing, seals with AES-GCM under `CREDENTIALS_KEY`, audits mode only, `requireOrgAdmin`.
  `getPaymentProviderForOrg` prefers org creds, refuses on unreadable, falls back to platform only when none.
  `/api/webhooks/pos` verifies with the platform secret, then the org's (located from `metadata.orgId` / the
  donation's `providerChargeRef`) — `src/lib/payments/webhook-verify.ts`. docs/13.
- **Onboarding is four steps** and `onboardedAt` is set only when a gateway is connected or the admin explicitly
  confirms skipping (audited `org.onboarding.completed { gatewayConnected }`); step order enforced (address required);
  BN stored normalized; done screen at `/dashboard/onboarding/done` with URL + QR + honest money statement; dashboard
  banner "you can't receive donations yet" links to `/dashboard/settings#payments`. docs/12, docs/help/GETTING_STARTED.
- **SEO**: `metadataBase`, canonical, OG/Twitter, generated `/opengraph-image`, JSON-LD (`alternateName` for
  "Kind Path"/"kind-path"; offers read from `src/lib/plans.ts`), sitemap of rank-worthy pages. Search Console still to
  be set up by the owner (docs/15 §5).
- **Env**: `src/lib/env.ts` validates the *shape* of `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`; `/api/ready` names
  missing/invalid vars. Pasted placeholders were the real-world failure.
- **Standing blockers**: WeVend merchant ID (`WV-ISV-50001`); Resend region move for Quebec; rotate the Resend key seen in a
  screenshot; Stripe platform key is sandbox.

## Tier 0 security backtest (2026-07-08, PASSED)
Adversarial pass over everything built in Tier 0. Results:
- **RLS**: `volunteers`/`volunteer_passes` confirmed in grants + tenant_tables + FORCE + tenant_isolation
  policy. Live: runtime role `kindpath_app` sees **0 rows without org context**, correct scoping with it.
  Volunteer queries/actions all go through `withTenant`; `/vp/[id]` uses adminDb but is token-gated +
  session-entitled (justified). completeDonation validates fund/campaign belong to the org.
- **Auth**: middleware only trusts `kindpath_session` (never the `kindpath_2fa` ticket → half-auth can't
  reach guarded routes); JWT + 2FA-ticket verify pin **HS256** (no alg-confusion/none); cross-portal
  redirects by kind; recovery codes bcrypt-hashed + consumed once; TOTP + 2FA rate-limited.
- **Money paths**: charge-token + hosted-state both HMAC/timingSafeEqual/expiry/**domain-separated**;
  completeDonation **de-dupes by providerChargeRef** (replay-safe) + trusts signed amount not client.
  **HARDENING ADDED**: hosted `confirmTransaction` now returns the gateway's charged `amount`; the
  `/response` page rejects with "Payment amount mismatch" (no receipt) if charged ≠ intended — verified
  E2E (cookie $100 vs $51.75 charge → blocked).
- **Rate limits**: login/signup/charge/retry/2fa/monitoring/logo/vol-pw all limited. **Secrets**: merchant
  creds AES-GCM sealed (0 plaintext rows in DB), absent from audit log / describe / server logs.
- **Headers**: CSP + X-Frame-Options DENY + X-Content-Type-Options + Referrer-Policy + Permissions-Policy
  + HSTS all present. Mock-gateway page 404s unless `mock-hosted`. 85 tests, tsc clean.

## GOTCHAs that cost time (read before debugging)
- **`docker exec` needs `-i`** for a heredoc, or the SQL silently goes nowhere and you'll chase a
  phantom "RLS didn't apply".
- **`prisma db execute` exits 1 on failure**, but `cmd | tail` reports *tail's* status — use
  `PIPESTATUS` or don't pipe when you're checking the exit code.
- **`prisma migrate diff --shadow-database-url`** leaves the shadow DB non-empty; use a fresh database
  name each time or `migrate deploy` will hit P3005.
- **The Claude preview browser strips cookies from non-GET requests**, so server actions can't be
  click-tested. Replay them with curl: GET the page, extract the `id` from the
  `$ACTION_1:0` hidden input and the `$ACTION_KEY` value, then POST them back as multipart fields
  along with the form fields. Verified working for login.
- **Restart the dev server after `prisma migrate`** — a stale Prisma client silently skips new columns.

## Compliance to remember
CRA official-receipt mandatory fields (all implemented in the PDF), split-receipting, receipt
void-on-refund + immutability (never hard-delete), **CASL** consent for marketing (only donors with
`caslConsent != none` AND `emailMarketingOptIn` get campaigns; unsubscribe + sender ID in every send),
PIPEDA/Quebec Law 25 (Canadian data residency), GST/HST on the SaaS subscription (not on donations),
records retention. See `docs/02_COMPLIANCE.md`.

## Memory
Durable project memory (persists across chats) is in
`~/.claude/projects/-Users-tanmayraj-Documents-KindPath/memory/` — `kindpath-project.md` has the running
build log (UPDATE 1–16) and is the most detailed history; `MEMORY.md` is the index.
