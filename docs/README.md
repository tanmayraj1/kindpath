# KindPath — Documentation Index

**KindPath** is a multi-tenant SaaS donation management & recurring giving platform for
Canadian religious institutions (temples, churches, mosques) and non-profit charities.
It automates recurring donations, donor management, and — critically — **CRA-compliant
official donation receipts** (and payment confirmations for non-registered orgs).

> Comparable products: Pushpay, CanadaHelps, Kindrid (Tithe.ly). KindPath differs by being
> SaaS-per-org (each org issues its own receipts under its own charity registration) with
> first-class fund/designation tracking (Zakat/Sadaqah, seva funds, building funds, etc.).

## Document set

| # | Document | What it covers |
|---|----------|----------------|
| 1 | [01_PRD_v2.md](01_PRD_v2.md) | Refined Product Requirements — corrected receipt-vs-invoice model, full MVP scope, revenue model |
| 2 | [02_COMPLIANCE.md](02_COMPLIANCE.md) | Canadian compliance bible — CRA receipts, split receipting, CASL, PIPEDA/Law 25, GST/HST, records retention |
| 3 | [03_ARCHITECTURE.md](03_ARCHITECTURE.md) | System architecture, multi-tenancy model, payment-provider abstraction, security, infrastructure |
| 4 | [04_DATA_MODEL.md](04_DATA_MODEL.md) | Database schema, entities, relationships, receipt numbering, audit trail |
| 5 | [05_SCREEN_FLOWS.md](05_SCREEN_FLOWS.md) | Every screen across all 3 portals, with logic, states, and the donate→address→receipt flow |
| 6 | [06_DASHBOARDS.md](06_DASHBOARDS.md) | Dashboard structure, metrics, and how the three portals connect and share data |
| 7 | [07_PROJECT_PLAN.md](07_PROJECT_PLAN.md) | Phased build plan, milestones, realistic timeline, risks |
| 8 | [08_DESIGN_SYSTEM.md](08_DESIGN_SYSTEM.md) | Design tokens, typography, spacing, component kit, UI guidelines |
| 9 | [09_BACKEND_SETUP.md](09_BACKEND_SETUP.md) | Local setup, DB/RLS, seeded logins, scripts (auth/payments sections now point at 14/13) |
| 10 | [10_DEPLOYMENT.md](10_DEPLOYMENT.md) | Production deployment reference — Neon, Vercel, env vars, cron, domain, checklist |
| 11 | [11_INTEGRATIONS.md](11_INTEGRATIONS.md) | What the client provides per integration (payments, email, DNS, compliance data) |
| 12 | [12_ONBOARDING.md](12_ONBOARDING.md) | **As built:** self-serve signup → four-step wizard (incl. payment gateway) → done screen; what gates `onboardedAt` |
| 13 | [13_PAYMENT_GATEWAYS.md](13_PAYMENT_GATEWAYS.md) | **As built:** platform default vs per-org Stripe accounts, encrypted credentials, refuse-don't-fall-back, webhooks per org, runbook |
| 14 | [14_AUTHENTICATION.md](14_AUTHENTICATION.md) | **As built:** four principals, custom JWT sessions, password+TOTP for staff, email codes for donors, why not Firebase |
| 15 | [15_GO_LIVE_RUNBOOK.md](15_GO_LIVE_RUNBOOK.md) | What was actually done to bring www.kind-path.org up, traps hit, and the before-first-real-charity checklist |
| — | [SHOWCASE_DEPLOY.md](SHOWCASE_DEPLOY.md) | Demo-only deploy (seed data, mock payments) — not for real money |
| — | [help/GETTING_STARTED.md](help/GETTING_STARTED.md) | **For charity admins** — plain-language setup guide |
| — | [../CHANGELOG.md](../CHANGELOG.md) | Behaviour changes by date |

## Key decisions locked in

- **Payment:** `PaymentProvider` seam with **Stripe live**, WeVend built (blocked on a merchant ID), mock for dev/demo only (refused in production). Each org connects **its own** Stripe account; the platform key is only the fallback and the product says so. See 13.
- **Charity status:** registered charities → official CRA donation receipts; non-registered → plain payment confirmations (never an official receipt).
- **Multi-tenancy:** row-level isolation in PostgreSQL with Row-Level Security (RLS), `org_id` on every tenant table.
- **Stack:** Next.js 14 (App Router) + Tailwind, PostgreSQL (Neon `ca-central-1`) with RLS, **custom JWT auth** (jose HS256 — not NextAuth, not Firebase; see 14), server-side PDF generation, Vercel `yul1`. Email via Resend (domain currently in ap-northeast-1 — see 02 §3).
- **Onboarding:** self-serve, org-side, four steps; `onboardedAt` only once a payment gateway is connected or explicitly skipped (see 12).
- **Donor sign-in:** password or emailed 6-digit code; staff keep password + TOTP (see 14).

## Glossary (read this first)

| Term | Meaning |
|------|---------|
| **Official Donation Receipt** | CRA-regulated tax document a registered charity issues to a donor. NOT an invoice. |
| **Payment Confirmation** | Non-tax document issued when the org is not a registered charity. |
| **Eligible amount** | Donation amount minus the value of any "advantage" the donor received. |
| **Advantage** | Anything of value the donor gets back (event ticket, dinner, gift). Reduces the eligible amount. |
| **Split receipting** | Issuing a receipt only for the eligible amount when an advantage exists. |
| **Fund / Designation** | What the gift is earmarked for (General, Building, Zakat, Sadaqah, Seva, Missions). |
| **BN/RR number** | Charity's CRA registration number (e.g. `123456789 RR 0001`). |
| **Subscription invoice** | The GST/HST-bearing invoice KindPath sends the ORG for the $25–30/mo SaaS fee. |
