# KindPath — Data Model

PostgreSQL with Row-Level Security. Every tenant-scoped table has `org_id` (FK →
`organizations.id`) and an RLS policy. Timestamps (`created_at`, `updated_at`) and soft-delete
(`deleted_at`) on most tables. IDs are UUIDs.

## 1. Entity-relationship overview

```
platform_admins                       organizations ──< org_users
                                            │  │  │
                          ┌─────────────────┘  │  └────────────< funds
                          │                     │
                     subscriptions          donors ──< donor_payment_methods
                          │                     │  │
                   subscription_invoices        │  └──< recurring_plans ──┐
                                                 │                         │
                                              donations <──────────────────┘
                                                 │
                                              receipts ──< receipt_sequences (per org)
                          notifications      audit_log      webhook_events
```

## 2. Tables

> **Scope note.** This section documents the original core. The schema has since grown
> (campaigns, events, ticket types, memberships, pledges, volunteers, team members, job runs,
> login codes, …). `prisma/schema.prisma` is the source of truth; only the additions that
> change how the core behaves are recorded here.

### login_codes (passwordless sign-in, donors/volunteers)
| Column | Notes |
|---|---|
| email | lowercased; **no org_id** — the code is keyed by address and unlocks every account at it |
| code_hash | sha256(`{email}:{code}`) — address bound into the digest |
| expires_at / used_at | 10-min TTL; single use; superseded on re-issue |
| attempt_count | 5 max, counted on the row (the rate limiter fails open) |
See [14_AUTHENTICATION.md](14_AUTHENTICATION.md) §4.


### organizations (tenant root)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text | Legal charity name (as on CRA file) |
| slug / subdomain | text unique | Tenant routing |
| logo_url, primary_color | text | Branding |
| address_line1/2, city, province, postal_code, country | text | On receipts |
| **charity_status** | enum(`registered`,`non_registered`) | Gates official receipts |
| **cra_registration_number** | text | `BN/RR`, required if registered |
| authorized_signatory_name | text | Appears on receipts |
| signatory_signature_url | text | Signature image |
| receipt_mode | enum(`per_gift`,`annual`,`both`) | |
| min_receipt_amount | numeric | Optional threshold |
| receipt_locality | text | "Place issued" field |
| default_currency | text | CAD default |
| pos_credentials_ref | text | Pointer to secret store (never plaintext) |
| status | enum(`active`,`suspended`,`archived`) | |

### org_users (org admins / signatories)
`id, org_id, email, password_hash, name, role(enum: org_admin, signatory, staff), status, last_login_at`

### platform_admins
`id, email, password_hash, name, role(enum: super_admin, support), status` — cross-tenant, audited.

### subscriptions (SaaS billing of the org)
`id, org_id, plan(enum: monthly, annual), price_cad, status(active/past_due/cancelled),
current_period_start, current_period_end, next_billing_date`

### subscription_invoices (KindPath → org, with GST/HST)
`id, org_id, subscription_id, invoice_number, subtotal, tax_rate, tax_amount, total,
province, status(draft/sent/paid/void), issued_at, pdf_url` — this is the **commercial invoice**.

### donors
| Column | Type | Notes |
|--------|------|-------|
| id, org_id | uuid | |
| first_name, middle_initial, last_name | text | Middle initial matters for CRA name |
| email, phone | text | |
| address_line1/2, city, province, postal_code, country | text | **Required for official receipt** |
| address_status | enum(`complete`,`pending`) | Drives `pending_details` receipts |
| casl_consent_status | enum(`express`,`implied`,`none`) | |
| casl_consent_at, casl_consent_source | timestamptz, text | |
| email_marketing_opt_in, sms_marketing_opt_in | bool | Unsubscribe flags |
| notes | text | Org-private |
| auth fields | password_hash (nullable — donors are created by donating) | Donor self-service login; passwordless codes live in `login_codes` |

### donor_payment_methods (tokens only)
`id, org_id, donor_id, provider_token, type(card/bank), brand, last4, exp_month, exp_year,
is_default, status(active/expired/removed)` — **no raw PAN/bank numbers, ever.**

### funds (designations)
`id, org_id, name, code, description, is_active` — e.g. General, Building, **Zakat**, **Sadaqah**,
Seva, Missions. Donations reference a fund.

### recurring_plans
`id, org_id, donor_id, fund_id, payment_method_id, amount, currency,
frequency(enum: weekly, monthly, quarterly, annual), billing_day, next_billing_date,
status(active/paused/cancelled/suspended), retry_count, provider_recurring_ref, started_at,
cancelled_at`

### donations (the financial event)
| Column | Type | Notes |
|--------|------|-------|
| id, org_id, donor_id, fund_id | uuid | |
| recurring_plan_id | uuid null | set if from a plan |
| type | enum(`one_time`,`recurring`,`cash`,`cheque`) | |
| amount | numeric | Gross gift |
| **advantage_value** | numeric default 0 | Value of anything received back |
| **advantage_description** | text | Required if advantage > 0 |
| **eligible_amount** | numeric | `amount - advantage_value` |
| currency | text | |
| status | enum(`pending`,`succeeded`,`failed`,`refunded`,`partially_refunded`) | |
| payment_method_id | uuid null | null for cash/cheque |
| provider_charge_ref | text | Gateway reference |
| received_at | timestamptz | CRA "date donation received" |
| receipt_id | uuid null | Linked receipt |

### receipts
| Column | Type | Notes |
|--------|------|-------|
| id, org_id | uuid | |
| donation_id | uuid null | null for annual consolidated |
| donor_id | uuid | |
| **serial_number** | text unique per org | From receipt_sequences |
| document_type | enum(`official`,`confirmation`,`annual`) | official only if org registered |
| **donor_name_snapshot, donor_address_snapshot** | text | Frozen at issue time |
| org_name_snapshot, org_reg_number_snapshot | text | Frozen at issue time |
| amount, advantage_value, eligible_amount | numeric | |
| place_issued | text | Locality |
| date_donation_received, date_issued | date | |
| signatory_name_snapshot | text | |
| status | enum(`issued`,`voided`,`replaced`) | never deleted |
| void_reason, replaces_serial | text | Audit of corrections |
| pdf_url | text | |
| year | int | For annual receipts |

> **Snapshots** freeze donor/org details as they were when the receipt was issued, so later
> profile edits never silently alter a legally-issued document.

### receipt_sequences (per-org numbering)
`org_id PK, year, last_number` — atomic increment yields gap-free serials like `2026-000123`.

### notifications
`id, org_id, donor_id, channel(email/sms), category(receipt/confirmation/billing_success/
billing_failure/card_expiring/marketing/announcement), status(queued/sent/failed),
casl_checked(bool), provider_ref, sent_at, payload`

### audit_log (append-only, immutable)
`id, org_id null, actor_type(platform_admin/org_user/system), actor_id, action, entity_type,
entity_id, before, after, ip, created_at` — covers impersonation, receipt void/replace, refund,
data export, subscription overrides.

### webhook_events (idempotency)
`id, provider_event_id unique, type, payload, processed_at, status(received/processed/failed)`

## 3. Key invariants
1. `eligible_amount = amount - advantage_value` (and `> 0` to issue an official receipt).
2. A `document_type = official` receipt requires `org.charity_status = registered`.
3. Serial numbers are gap-free and unique per `(org_id, year)`.
4. Receipts are never hard-deleted; corrections create void + replacement rows.
5. A refunded donation's receipt transitions to `voided` automatically.
6. Marketing notifications require `casl_checked = true` and valid consent.
7. Every tenant table read/write is filtered by `org_id` via RLS.

## 4. Indexing (performance)
- `donations(org_id, received_at)`, `donations(org_id, donor_id)`, `donations(org_id, fund_id)`
- `recurring_plans(org_id, next_billing_date, status)` (billing job)
- `receipts(org_id, serial_number)`, `receipts(org_id, donor_id, year)`
- `donors(org_id, email)`, `webhook_events(provider_event_id)`
