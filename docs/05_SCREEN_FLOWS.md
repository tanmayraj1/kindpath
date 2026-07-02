# KindPath — Screen Flows & Logic

Every screen across the three portals, with its purpose, key elements, logic, and states.
Notation: `→` navigation, `⟳` async/job, `⚑` compliance-critical.

---

## A. Donor flows

### A0. The donate → address → receipt flow ⚑ (the core ask)

```
[Org public donation page]  (org-branded: logo, colour)
        │
        ▼
1. Choose gift
   - Amount (preset chips + custom)
   - Fund/designation dropdown (General, Building, Zakat, Sadaqah, Seva…)
   - One-time  OR  Recurring (frequency: weekly/monthly/quarterly/annual)
        │
        ▼
2. Payment
   - Provider hosted card fields (tokenized — no raw data hits KindPath)
   - On submit → PaymentGateway.charge / createRecurring
        │
        ├── FAIL → show error, allow retry (no donation recorded)
        │
        ▼ SUCCESS (donation recorded immediately)
3. "Payment successful 🎉"  + prompt:
   "Enter your details to receive your official tax receipt"
   Fields: full name (incl. middle initial), email,
           address line 1/2, city, province, postal code
   - Pre-filled if donor is logged in / recognized by email
   - Address format validation (Canada Post style; optional autocomplete)
        │
        ├── [Skip for now] → donation saved, receipt = pending_details
        │                    (donor can complete later in portal / at year-end)
        │
        ▼ [Submit details]
4. Branch on org.charity_status:
   ├─ registered      → ReceiptService issues OFFICIAL receipt (serial #, eligible amount,
   │                     signatory, CRA fields) ⚑
   └─ non_registered  → issue PAYMENT CONFIRMATION (clearly "not a tax receipt") ⚑
        │
        ▼
5. ⟳ Email document + show download button + store in donor portal
   ⟳ Send donation-confirmation notification
```

**Edge cases handled:** advantage (event ticket) → eligible amount reduced; amount below
`min_receipt_amount` → confirmation only; anonymous (skip) → `pending_details`; duplicate email
→ match existing donor; refund later → receipt auto-voided.

### A1. Donor registration / login
Email + password, OTP verification, password reset, optional Google login → Donor dashboard.
First-time donors created during A0 can claim their account via the receipt email.

### A2. Donor dashboard (home)
Summary cards: total given (year + lifetime), active recurring plans, next billing date,
**receipts pending details** banner if any. Quick actions: Give again, Download annual receipt.

### A3. Donation history
Chronological table (date, fund, amount, type, status, receipt link). Filter by date/type/amount.
Export PDF/CSV. Click row → donation detail + receipt download.

### A4. Recurring plan management
List of plans (fund, amount, frequency, next date, status). Actions per plan:
**Pause / Modify amount / Change frequency / Cancel** — all *effective next cycle* (current
period unaffected). Confirmation modals; changes logged.

### A5. Payment methods
List tokenized methods (brand, last4, expiry, default). Add new (hosted fields) / set default /
remove. Expiring-card warning banner.

### A6. Receipts & tax documents ⚑
All issued documents (per-gift + annual). Download PDF. "Generate annual consolidated receipt"
for a selected tax year (registered orgs). Pending-details items prompt to complete address.

### A7. Profile & preferences
Edit personal details + address (updates future receipts, not issued ones). Communication
preferences + **CASL consent toggles** (email/SMS marketing) with unsubscribe.

---

## B. Organization Admin flows

### B1. Org login → Org dashboard
See [Dashboards](06_DASHBOARDS.md#2-organization-admin-dashboard). KPIs, charts, alerts.

### B2. Donor database
Searchable/filterable donor table (name, email, last gift, plan status, total given, CASL).
Click → donor profile: contact + **address**, history, plans, payment methods (masked), notes,
consent. Actions: edit, add manual/cash donation, message, export.

### B3. Funds / designations
CRUD list of funds. Activate/deactivate. Cannot delete a fund with history (deactivate instead).
Drives the donation-page dropdown and fund-wise reporting.

### B4. Recurring plans (org view)
All plans across donors. Filter by status/fund/frequency. View upcoming billings; manual
override (charge now / pause / cancel); see retry status on failures.

### B5. One-time & manual donations
Log offline gifts (cash/cheque): donor, fund, amount, date received, advantage (if any). Triggers
receipt/confirmation just like online gifts. Online one-time also visible here.

### B6. Receipts management ⚑
- List all issued receipts (serial, donor, amount, type, status).
- Void a receipt (reason required) → audit logged; reissue replacement.
- Bulk-generate annual consolidated receipts for a tax year.
- Configure receipt template/branding, signatory, locality, min amount, per-gift vs annual mode.
- Pending-details queue: donors who haven't supplied an address.

### B7. Reporting
Monthly/annual giving summaries, donor retention, top donors, fund-wise revenue, failed-payment
tracking, recurring vs one-time split. Export CSV/PDF.

### B8. Communications ⚑
Compose org-branded email/SMS to **segments** (all, lapsed, high-value, by fund, recurring).
**CASL guardrails:** recipients without consent are auto-excluded with a visible count; every
message carries sender ID + unsubscribe. Schedule/send; view delivery stats.

### B9. Failed payment management
Queue of failed charges with retry schedule and donor-notification status. Manual retry / mark
resolved / suspend plan. Configure retry intervals + max attempts.

### B10. Org settings & branding
Logo, colours, public donation-page config, charity status + BN/RR (read-only after verification),
authorized signatory + signature image, notification templates, comms defaults.

---

## C. Platform Super Admin flows

### C1. Super admin login → Platform dashboard
See [Dashboards](06_DASHBOARDS.md#1-platform-super-admin-dashboard). Platform-wide KPIs.

### C2. Organization management
List all orgs (status, plan, donors, volume, MRR). Create org (name, slug/subdomain, branding,
**charity status + BN/RR**, POS credentials → secret store). Edit / suspend / archive (archive =
retention-safe, never hard delete ⚑).

### C3. Subscription management
Per-org SaaS billing: plan tier, status, next billing, manual bill, credits/overrides,
upgrade/downgrade. Generate **GST/HST subscription invoices** ⚑.

### C4. Platform analytics
Active orgs, total donors, total donation volume/value, MRR, churn, growth trends. Drill into a
single org.

### C5. Support tools ⚑
Impersonate an org admin (**fully audited**, time-boxed), view error/webhook logs, manually
trigger failed-payment retries, reset donor passwords, replay webhooks.

### C6. Onboarding flow
Manual (admin creates) or self-serve (org signs up → provides name/logo/slug/charity status/POS
creds → KindPath verifies → activates). Configurable.

---

## D. Cross-cutting states & rules
- **Empty states:** every list has a helpful empty state (e.g. "No funds yet — create your first").
- **Loading/optimistic UI** on mutations; toasts on success/error.
- **Permission gating:** UI hides actions the role can't perform; server re-checks (never trust client).
- **Tenant context:** org admins and donors are pinned to one `org_id`; super admin can switch.
- **Receipt immutability:** issued receipts are read-only; "edit" = void + reissue ⚑.
- **Mobile-responsive:** donation page and donor portal are mobile-first (most giving is on phones).
