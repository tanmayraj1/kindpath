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
| 9 | [09_BACKEND_SETUP.md](09_BACKEND_SETUP.md) | Local setup, DB/RLS, auth model, payment abstraction, seeded logins |

## Key decisions locked in

- **Payment:** abstraction layer (`PaymentProvider` interface) + mock adapter now; client's own POS API plugs in later as one adapter.
- **Charity status:** registered charities → official CRA donation receipts; non-registered → plain payment confirmations (never an official receipt).
- **Multi-tenancy:** row-level isolation in PostgreSQL with Row-Level Security (RLS), `org_id` on every tenant table.
- **Stack:** Next.js 14 (App Router) + Tailwind, PostgreSQL, NextAuth/JWT, server-side PDF generation, Canadian-region hosting.

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
