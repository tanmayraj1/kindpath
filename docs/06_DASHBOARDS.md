# KindPath — Dashboards & Portal Connections

How each dashboard works, what it shows, the data behind each widget, and how the three portals
connect and share data.

---

## 1. Platform Super Admin dashboard

**Audience:** KindPath owner. **Scope:** cross-tenant (privileged role).

| Widget | Data source | Logic |
|--------|-------------|-------|
| Active organizations | `organizations` | count where status=active |
| MRR (monthly recurring revenue) | `subscriptions` | sum of normalized monthly price of active subs |
| Churn rate | `subscriptions` | cancelled this period ÷ active at period start |
| Total donors (platform) | `donors` | count across all orgs |
| Donation volume & value | `donations` | count + sum(amount) where status=succeeded, by period |
| New orgs (trend) | `organizations` | created_at over time |
| Failed payments (platform) | `donations` + retries | failures needing attention |
| Recent activity / alerts | `audit_log`, `webhook_events` | impersonations, webhook failures, past-due subs |

**Actions from dashboard:** create org, open org detail, trigger subscription billing, view logs,
impersonate (audited). Drill-down: click any org → that org's mini-dashboard + management.

---

## 2. Organization Admin dashboard

**Audience:** temple/church/mosque staff. **Scope:** single `org_id` (RLS-enforced).

| Widget | Data source | Logic |
|--------|-------------|-------|
| Total raised (period + YTD) | `donations` | sum(amount) succeeded, filtered by date |
| Active recurring donors | `recurring_plans` | count where status=active |
| Expected recurring revenue | `recurring_plans` | sum of normalized monthly amounts |
| New vs returning donors | `donors`,`donations` | first-gift vs repeat in period |
| Fund-wise breakdown | `donations`+`funds` | sum(amount) grouped by fund (Zakat/Building/…) |
| Donor retention | `donations` | donors giving in consecutive periods |
| Top donors | `donations` | sum by donor, ranked |
| Receipts issued / pending | `receipts`,`donors` | issued count + pending_details queue ⚑ |
| Failed payments | `donations`/retries | failures + retry status, link to queue |
| Upcoming billings | `recurring_plans` | next_billing_date within N days |

**Actions:** add donor / log manual gift, create fund, message a segment, void/reissue receipt,
generate annual receipts, export reports.

---

## 3. Donor dashboard

**Audience:** individual donor. **Scope:** their own records within one org.

| Widget | Data source | Logic |
|--------|-------------|-------|
| Given this year / lifetime | `donations` | sum(eligible_amount) by year + all-time |
| Active recurring plans | `recurring_plans` | their active plans + next date |
| Pending receipt details | `receipts`+`donors` | banner if address missing ⚑ |
| Recent donations | `donations` | latest gifts + receipt links |
| Payment method status | `donor_payment_methods` | expiring-card warning |
| Annual tax receipt | `receipts` | one-click consolidated download (registered orgs) |

**Actions:** give again, manage/pause/cancel recurring, update payment method, download receipts,
complete address, update CASL preferences.

---

## 4. How the portals connect (data flow)

```
SUPER ADMIN ──views/suspends────► ORGANIZATION (tenant; org connects its OWN gateway — see 13)
     ▲                                     │
     │ platform analytics                  │ defines funds, recurring plans, receipt settings
     │ (aggregates all orgs)               ▼
     │                              ORG ADMIN ──manages──► DONORS ──belong to──► ORG
     │                                     │                  │
     │                                     │                  │ give via org-branded page
     │                                     ▼                  ▼
     └──────────────── DONATIONS ◄─────────────────── DONOR PORTAL (self-service)
                            │
                  ┌─────────┼──────────┐
                  ▼         ▼          ▼
              RECEIPTS  NOTIFICATIONS  REPORTS/ANALYTICS
              (donor +   (donor)       (org admin + roll up to super admin)
               org view)
```

**Connection points (single source of truth, viewed by multiple roles):**

1. **Organization** is created by self-serve signup (see 12) and can be viewed/suspended by Super
   Admin → everything an Org Admin and its Donors see is scoped to it. Charity status set here decides official-receipt vs confirmation everywhere.
2. **Funds** defined by Org Admin → appear in the donor donation page dropdown and in org
   fund-wise reporting.
3. **A donation** is one record viewed three ways: donor sees it in history; org admin sees it
   in reporting/donor profile; super admin sees it aggregated in platform volume.
4. **A receipt** is generated once and surfaced in both the donor portal and the org receipts
   list; voids by org admin reflect instantly to the donor.
5. **Recurring plans** created by donor or org admin are executed by the **billing engine**;
   resulting donations + receipts + notifications flow back to all three views.
6. **Notifications** are triggered by system events (receipt issued, billing failed) and by org
   admin campaigns (CASL-gated); donor sees results in their inbox + preferences.
7. **Audit log** records privileged actions (impersonation, void, refund) → visible to super
   admin for support/compliance.

**Isolation guarantee:** an Org Admin never sees other orgs' data; a Donor never sees other
donors' data; only the Super Admin crosses tenants, and every cross-tenant action is audited.
RLS on `org_id` enforces this at the database layer regardless of application bugs.
