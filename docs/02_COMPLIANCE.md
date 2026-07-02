# KindPath — Canadian Compliance Reference

This is the compliance "source of truth." Every receipt/notification/data feature must trace
back to a rule here. **This is product guidance, not legal advice — have a Canadian charity
lawyer review receipt templates and onboarding terms before launch.**

---

## 1. Official donation receipts (CRA — Income Tax Regulations s.3501)

Only a **CRA-registered charity** may issue an official donation receipt. KindPath enforces
this: orgs marked `non_registered` can never generate one (they issue payment confirmations).

### 1.1 Mandatory fields — cash gifts
Every official cash-gift receipt MUST contain:

1. A statement that it is an **official receipt for income tax purposes**
2. The **charity's name and address** as on file with the CRA
3. The charity's **registration number** (`BN/RR`, e.g. `123456789 RR 0001`)
4. A unique **serial number**
5. The **place or locality** where the receipt was issued
6. The **date (or year) the donation was received**
7. The **date the receipt was issued**
8. The **donor's full name** (including middle initial) **and address**
9. The **amount of the gift**
10. The **eligible amount** of the gift (see §1.3 split receipting)
11. The **name and signature** of an individual authorized by the charity
12. The **name and website of the CRA**: `canada.ca/charities-giving`

> Field #8 is the donor-address requirement that drives the donate→address→receipt flow.

### 1.2 Additional fields — non-cash (gifts in kind)
If a gift is property rather than cash, also include: date received, brief description of the
property, name/address of the appraiser (if appraised), and the deemed fair market value.
*MVP scope: cash gifts only; gift-in-kind is a flagged future item.*

### 1.3 Split receipting & "advantage" (CRITICAL)
If the donor receives an **advantage** (anything of value back — gala ticket, dinner, merch),
the **eligible amount = donation amount − advantage value**. The receipt shows both. If the
advantage exceeds 80% of the gift, generally no receipt may be issued.

KindPath data: each donation stores `amount`, `advantage_value`, `advantage_description`,
and a computed `eligible_amount`. Receipts render all three when an advantage exists.

### 1.4 Receipt numbering & integrity
- Serial numbers are **sequential and unique per organization** (e.g. `2026-000123`).
- Receipts are **immutable** once issued. Corrections = void + reissue.
- A **voided** receipt is never deleted — it's retained with status `voided` and a reason.
- A **replacement** receipt must be marked as replacing the original serial number.

### 1.5 Refunds → cancellation
If a donation is refunded (full or partial), the linked receipt is **automatically voided**.
For partial refunds, void the original and issue a corrected receipt for the new eligible
amount. All actions are written to the immutable audit log.

### 1.6 Annual consolidated receipts
A registered org may issue one **year-end consolidated receipt** summing a donor's eligible
gifts for the calendar year. KindPath supports both per-gift and annual modes (org-configurable).
A consolidated receipt and per-gift receipts must not double-count the same gift.

### 1.7 Minimum thresholds & anonymous gifts
Issuing receipts is at the charity's discretion; many set a minimum (e.g. $20). KindPath lets
orgs set a `min_receipt_amount`. Anonymous/no-address donations are recorded but receive a
receipt only once donor details are completed (status `pending_details`).

---

## 2. CASL — Canada's Anti-Spam Legislation
Applies to **commercial/marketing** electronic messages (the Donor Communication & announcement
features). Transactional messages (a receipt, a billing-failure alert) are generally exempt, but
KindPath treats marketing strictly:

- **Consent:** store express or implied consent per donor, with timestamp and source.
- **Identification:** sender name + physical mailing address in every marketing message.
- **Unsubscribe:** one-click unsubscribe in every marketing message, honored within 10 business days (we honor immediately).
- KindPath blocks sending marketing messages to donors without valid consent.

Data: `donors.casl_consent_status` (express/implied/none), `casl_consent_at`, `casl_consent_source`,
plus per-channel (email/SMS) unsubscribe flags.

---

## 3. Privacy — PIPEDA & Quebec Law 25
- **PIPEDA** (federal): collect only what's needed, with consent and a stated purpose; allow
  access/correction; report breaches.
- **Quebec Law 25** (stricter): explicit consent, a designated privacy officer, breach
  notification, privacy-by-default. If serving Quebec orgs, this governs.
- **Data residency:** host the database and backups in a **Canadian region**. Keep PII
  encrypted at rest and in transit.
- **Donor rights:** support data export and deletion requests (deletion subject to CRA
  retention — see §5; receipts are retained even if the donor profile is anonymized).

---

## 4. Sales tax (GST/HST) — on the SaaS fee, NOT donations
- **Donations** are gifts with no consideration → **no GST/HST**.
- **KindPath's subscription fee** to orgs **is taxable** → charge GST/HST by the org's
  province (e.g. 5% GST in AB, 13% HST in ON, etc.). Subscription invoices show the tax line
  and KindPath's own business number.
- Payment-processing commissions may also be taxable — confirm with an accountant.

---

## 5. Records retention (CRA)
Registered charities must keep records to support receipts. KindPath therefore:
- **Never hard-deletes** receipts or donation records; "delete org" = archive + retention hold.
- Retains issued/voided receipts and the audit log for the CRA-required period (books & records
  generally **6 years** from the end of the last tax year they relate to; longer for some).
- Keeps an **immutable audit trail** of receipt issue/void/replace and admin impersonation.

---

## 6. Security baseline
- **PCI-DSS:** minimized scope — tokenization at the POS/gateway; **no raw PAN/bank data** on
  KindPath servers. Card entry uses the provider's hosted fields/iframe where possible.
- **OWASP Top 10:** input validation, parameterized queries, authn/authz on every route,
  rate limiting, CSRF protection, secure session handling.
- **Tenant isolation:** PostgreSQL Row-Level Security keyed on `org_id`; automated tests prove
  cross-tenant reads are impossible.
- **Encryption:** TLS in transit; AES at rest; secrets in a managed secret store.
- **Auditability:** every privileged action (impersonation, receipt void, refund, data export) logged.

---

## 7. Compliance → feature traceability
| Rule | Enforced by feature |
|------|---------------------|
| Receipt mandatory fields (§1.1) | Receipt PDF template + donation/donor data capture |
| Donor address (§1.1 #8) | Donate→address→receipt flow ([screen flows](05_SCREEN_FLOWS.md)) |
| Split receipting (§1.3) | `advantage_value` / `eligible_amount` on donations |
| Numbering & immutability (§1.4) | `receipts` + `receipt_sequences` tables ([data model](04_DATA_MODEL.md)) |
| Refund cancellation (§1.5) | Webhook → void receipt → audit log |
| Registered-only receipts | `organizations.charity_status` gate |
| CASL (§2) | `donors.casl_*` fields + send-time consent check |
| Law 25 / residency (§3) | Canadian-region hosting, encryption, export/delete |
| GST/HST (§4) | Subscription invoice tax engine |
| Retention (§5) | Soft-delete + immutable audit log |
