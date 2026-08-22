# Changelog

All notable changes to KindPath. Format follows [Keep a Changelog](https://keepachangelog.com/);
entries are per behaviour change, not per commit. Dates are when the change reached `main`.

## [Unreleased]

### Added
- **Onboarding step 4 — Get paid.** The Stripe connect form (same as Settings → Payments) is
  now part of setup. `onboardedAt` is set only when a gateway is connected, or when the admin
  explicitly confirms skipping; either way an `org.onboarding.completed` audit row records
  `gatewayConnected`. (`ad1d61b`)
- **Onboarding done screen** at `/dashboard/onboarding/done`: giving URL, QR, and an honest
  statement of whether a donation made now would reach the charity (test-card hint in test mode).
- **Dashboard banner** "You can't receive donations yet" for onboarded orgs without a readable
  gateway, linking to `Settings#payments`.
- **Per-org webhook verification.** `/api/webhooks/pos` now verifies against the org's own
  Stripe secret when the platform secret doesn't match (org located from `metadata.orgId` or the
  payment-intent reference). Refunds issued from a charity's own Stripe dashboard now void the
  receipt. (`734d305`)
- Docs: `12_ONBOARDING`, `13_PAYMENT_GATEWAYS`, `14_AUTHENTICATION`, `15_GO_LIVE_RUNBOOK`,
  `help/GETTING_STARTED`, this changelog.

### Changed
- Onboarding enforces step order: `?step=2–4` redirect to step 1 until the address is saved;
  the finish action re-checks server-side. Province is a select over the tax list; postal code is
  validated and formatted; the CRA BN is stored normalized (`123456789RR0001`).
- Onboarding reskinned to the surface tokens (`Field`, `FormAlert`, `rounded-input/card`); the
  pre-reskin indigo default colour is gone. Brand hex centralised in `src/lib/brand.ts`; QR
  generation centralised in `src/lib/qr.ts` (QR was still indigo).
- Structured data reads plan prices from `src/lib/plans.ts` — it advertised 24/49/166 as monthly
  prices while the app bills 29/59/199.
- Expired sign-in codes are purged on the daily billing cron.

## 2026-08-23

### Added
- SEO: `metadataBase`, canonical, Open Graph/Twitter, generated `/opengraph-image`, JSON-LD
  (`Organization` with `alternateName` for "Kind Path"/"kind-path", `WebSite`,
  `SoftwareApplication`), sitemap limited to rank-worthy pages. (`a0fe0ba`)
- **Organizations can connect their own payment gateway** from Settings → Payments:
  `connectStripeAccount` (shape check, live probe against `/v1/balance` before storing, AES-GCM
  at rest, audit of mode only) and `disconnectGateway`; `GatewayForm` with the three states
  none / connected / unreadable; `requireOrgAdmin`. (`d768e23`)

### Changed
- `src/lib/env.ts` validates the **shape** of `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET`,
  not just presence — pasted placeholders are rejected by name. (`5a719c4`)

## 2026-08-22

### Added
- **Passwordless email sign-in for donors and volunteers** at `/login/code`: `LoginCode` model,
  hashed codes bound to the address, 10-min TTL, 5 attempts counted on the row, supersession,
  enumeration-safe responses, account chooser for shared addresses. (`807a186`)
- Production email proven live through Resend (plain layout + a real CRA receipt with signed
  PDF link). (`9e2ee70`)

### Fixed
- Receipt email "Set up portal access" link used the pre-reskin indigo even on white-labelled
  receipts; now `brandHex(orgColour)`. (`9e2ee70`)

### Notes
- Resend sending domain verified in **ap-northeast-1 (Tokyo)**; residency caveat recorded in
  `docs/02_COMPLIANCE.md` §3.
- Production brought up on a sandbox Stripe key as the platform default; see
  `docs/15_GO_LIVE_RUNBOOK.md` §6 for what must change before the first real charity.
