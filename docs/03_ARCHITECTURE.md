# KindPath — Technical Architecture

## 1. High-level architecture

```
                       ┌─────────────────────────────────────────────┐
                       │              Browsers (3 portals)            │
                       │  Super Admin · Org Admin · Donor self-serve  │
                       └───────────────────────┬─────────────────────┘
                                               │ HTTPS
                       ┌───────────────────────▼─────────────────────┐
                       │        Next.js 14 (App Router) + Tailwind    │
                       │  SSR/RSC pages · API routes · middleware     │
                       │  AuthN (NextAuth/JWT) · RBAC · tenant ctx    │
                       └───┬─────────────┬──────────────┬─────────────┘
                           │             │              │
              ┌────────────▼───┐  ┌──────▼───────┐  ┌──▼───────────────┐
              │  Domain/services│  │  Job runner  │  │  PaymentProvider │
              │  (business logic)│ │ (billing,    │  │  interface       │
              │  receipts, funds │ │  retries,    │  │  ┌─────────────┐ │
              │  donors, plans   │ │  receipts,   │  │  │ MockAdapter │ │
              └───────┬─────────┘  │  notifs)     │  │  ├─────────────┤ │
                      │            └──────┬───────┘  │  │ ClientPOS   │ │
        ┌─────────────▼──────────────────▼──────┐   │  │ Adapter(later)│
        │   PostgreSQL (RLS, org_id isolation)   │   │  └─────────────┘ │
        │   + audit log + receipt sequences      │   └──┬───────────────┘
        └────────────────────────────────────────┘      │ REST + webhooks
                      │                                   ▼
        ┌─────────────▼───────────┐            ┌──────────────────────┐
        │ Object storage (PDFs)   │            │  Client POS / Gateway │
        │ Email (Resend)          │            │  (tokenize, charge,   │
        │ SMS (Twilio/MSG91)      │            │   recurring, refund)  │
        └─────────────────────────┘            └──────────────────────┘
```

## 2. Technology stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| Frontend | Next.js 14 App Router + Tailwind | SSR/RSC, fast, mobile-responsive, one app for all 3 portals |
| Backend | Next.js API routes (+ extractable service layer) | Co-located; can split to a Node/Express service later |
| Database | PostgreSQL + Row-Level Security | Strong relational integrity, RLS for tenant isolation, audit-friendly |
| ORM | Prisma (or Drizzle) | Type-safe schema + migrations |
| Auth | NextAuth.js / JWT + OTP | Multi-role login, RBAC, OTP verification |
| Jobs/scheduler | Cron worker (e.g. node-cron / BullMQ + Redis) | Recurring billing, retries, receipt + notification dispatch |
| PDF | `@react-pdf/renderer` (or Puppeteer) | Server-side receipt/invoice PDFs |
| Email | Resend | Transactional + marketing (with CASL controls) |
| SMS | Twilio / MSG91 | Alerts and OTP |
| Storage | S3-compatible (Canadian region) | Receipt/invoice PDFs, logos |
| Hosting | Canadian-region cloud (AWS ca-central-1 / GCP montréal / Vercel + Cdn DB) | Law 25 residency |

## 3. Multi-tenancy model

**Row-level isolation** (not schema-per-tenant): every tenant-scoped table carries `org_id`,
and PostgreSQL **Row-Level Security** policies restrict each request to its `org_id`.

- A request's tenant is resolved from the subdomain/slug + the authenticated user's `org_id`.
- The DB session sets `app.current_org_id`; RLS policies use it: `USING (org_id = current_setting('app.current_org_id')::uuid)`.
- The **Platform Super Admin** uses a privileged role that can cross tenants (audited),
  and impersonation explicitly sets the target `org_id`.
- Why row-level over schema-per-tenant: simpler migrations, cheaper at hundreds of orgs,
  easier cross-tenant platform analytics, fewer connection-pool issues.

## 4. Payment-provider abstraction (key design for your POS)

All payment operations go through one interface so your POS API plugs in as a single adapter.

```ts
interface PaymentProvider {
  // Tokenize a card/bank account; returns a provider token, never raw data.
  enrollPaymentMethod(input: EnrollInput): Promise<PaymentToken>;
  // Charge a one-time amount against a token.
  charge(input: ChargeInput): Promise<ChargeResult>;
  // Create/update/cancel a recurring schedule (if the provider manages recurring),
  // OR KindPath drives recurring itself via the job runner using charge().
  createRecurring(input: RecurringInput): Promise<RecurringRef>;
  cancelRecurring(ref: RecurringRef): Promise<void>;
  refund(input: RefundInput): Promise<RefundResult>;
  // Verify + parse an inbound webhook event into a normalized PaymentEvent.
  verifyWebhook(req: RawWebhook): Promise<PaymentEvent>;
}
```

- **Now:** `MockAdapter` simulates tokenization, charges, recurring, refunds, and emits
  webhook-style events so the full flow (receipts, retries, notifications) is buildable and
  testable end-to-end without the real POS.
- **Later:** `ClientPosAdapter` implements the same interface against your POS REST API.
  No business logic changes — only the adapter.
- **Normalized events** (`payment.succeeded`, `payment.failed`, `refund.succeeded`,
  `method.expiring`) decouple KindPath logic from provider-specific payloads.
- **Idempotency:** every webhook carries a provider event id; we store processed ids to
  guarantee exactly-once handling.

## 5. Core backend services (domain layer)
| Service | Responsibility |
|---------|----------------|
| `OrgService` | Org CRUD, branding, charity status + BN/RR, slug/subdomain |
| `SubscriptionService` | SaaS plan/billing, GST/HST invoice generation |
| `DonorService` | Donor CRUD, CASL consent, comms prefs, dedupe |
| `FundService` | Funds/designations per org |
| `DonationService` | Record one-time/recurring/cash donations; compute eligible amount |
| `RecurringService` | Plan lifecycle; next-billing scheduling |
| `BillingEngine` | Job-driven recurring charges + retry logic |
| `ReceiptService` | Serial numbering, PDF generation, void/replace, annual consolidation |
| `NotificationService` | Email/SMS dispatch with CASL gating + templating |
| `PaymentGateway` | Wraps the `PaymentProvider` adapter + webhook routing |
| `AuditService` | Append-only audit log writes |
| `AnalyticsService` | Platform + org dashboard aggregations |

## 6. Receipt & billing flows (sequence summaries)

**Donation → receipt**
1. Donor submits donation → `PaymentGateway.charge` (or recurring schedule fires).
2. Provider returns success → `DonationService` records donation (amount, fund, advantage, eligible).
3. Donor address present? → `ReceiptService` issues serial + renders PDF; else mark `pending_details`.
4. Org registered? official receipt : payment confirmation.
5. `NotificationService` emails the document; it appears in the donor portal.

**Recurring billing (job runner)**
1. Cron selects plans where `next_billing_date <= today` and `status = active`.
2. For each: `charge(token, amount)`. Success → donation + receipt + notify; advance `next_billing_date`.
3. Failure → schedule retry (e.g. +3/+5/+7 days), notify donor; after max retries → suspend plan + alert.

**Refund**
1. Refund webhook → `DonationService` marks refunded → `ReceiptService.void(receipt, reason)` →
   audit log → donor notified. Partial refund → reissue corrected receipt.

## 7. Security architecture
- HTTPS/TLS everywhere; HSTS.
- RBAC middleware on every route; tenant context required for org-scoped routes.
- PostgreSQL RLS as a second line of defense behind app-level checks.
- Secrets (POS keys, signing keys) in a managed secret store, never in DB rows in plaintext.
- Rate limiting + bot protection on auth and donation endpoints.
- Webhook signature verification + idempotency.
- Audit log for privileged actions (impersonation, void, refund, export).
- PII encrypted at rest; PDFs in access-controlled storage with signed URLs.

## 8. Environments
- **Local:** MockAdapter, seeded demo org (registered) + demo org (non-registered).
- **Staging:** sandbox POS adapter when available; full email/SMS in test mode.
- **Production:** Canadian region, real POS adapter, monitoring + backups + alerting.
