# KindPath — Product Requirements Document v2

**Reference:** PRD-2026-KP-002 · **Supersedes:** PRD-2026-YS-001 (Rytful Media, May 2026)
**Project type:** Multi-tenant SaaS — Donor Management & Recurring Giving
**Platform:** Web MVP, cloud-hosted, mobile-responsive · **Market:** Canadian temples, churches, mosques, charities

> **What changed from v1 and why:** v1 conflated "invoice" with the CRA "official donation
> receipt." These are legally distinct documents (see [Compliance](02_COMPLIANCE.md)). v2 also
> adds: split receipting, annual consolidated receipts, receipt cancellation on refund,
> fund/designation tracking, CASL consent, GST/HST on SaaS billing, a payment-provider
> abstraction (client's POS plugs in later), and a non-registered-org confirmation path.

---

## 1. Executive summary

KindPath is a true multi-tenant SaaS: one codebase and deployment, with complete data,
branding, and reporting isolation per organization. Each religious institution gets its own
branded donor portal, donor database, and admin panel, invisible to other tenants.

The platform produces **two distinct financial documents**:

1. **Donor-facing:** an *Official Donation Receipt* (registered charities) or *Payment
   Confirmation* (non-registered orgs), generated automatically after each donation.
2. **Org-facing:** a *Subscription Invoice* with GST/HST for the monthly SaaS fee.

## 2. Business model

- **Subscription revenue:** CAD $25–30 / org / month (monthly or annual), **plus GST/HST**.
- **Payment processing revenue:** commission/markup on donation volume via the integrated POS API.
- **Future:** event fundraising fees, QR-kiosk licensing, premium integrations, mobile app tiers.

## 3. User roles (4 types)

| Role | Who | Core capability |
|------|-----|-----------------|
| **Platform Super Admin** | KindPath owner | Manage orgs, subscriptions, platform analytics, support tooling |
| **Organization Admin** | Temple/church/mosque staff | Manage donors, funds, recurring plans, receipts, reporting, communications |
| **Donor** | Individual giver | Self-service: history, recurring management, payment methods, receipt downloads |
| **Billing/Payment Engine** | Backend (automated) | Tokenized enrollment, recurring billing, retries, receipt generation |

Optional sub-role: **Authorized Signatory** (an org user whose name/signature appears on
official receipts — CRA requires an authorized individual).

## 4. MVP feature scope

### 4.1 Platform Super Admin portal
| Feature | Notes |
|---|---|
| Organization management | Create/edit/suspend/delete orgs; set branding; capture charity status + BN/RR number |
| Charity verification | Record CRA registration number; mark org as `registered` / `non_registered` |
| Subscription management | Plan tier, billing status, manual billing, credits/overrides, GST/HST handling |
| Platform analytics | Active orgs, total donors, donation volume/value, MRR, churn |
| Support tools | Impersonate org admin (audited), view logs, retry failed payments, reset donor passwords |
| Onboarding flow | *Built as self-serve on the org side, not here* — see [12_ONBOARDING.md](12_ONBOARDING.md). Super admin can view/suspend; payment credentials are connected by the org itself |

### 4.2 Organization Admin portal
| Feature | Notes |
|---|---|
| Donor database | Profiles: name, email, phone, **address**, history, plan status, comms prefs, **CASL consent**, notes |
| Fund / designation management | Define funds (General, Building, Zakat, Sadaqah, Seva, Missions…); donations are tagged to a fund |
| Recurring donation plans | Weekly/monthly/quarterly/annual; assign donors; next billing date/amount/status |
| One-time donations | Online card + manual entry (cash/cheque) |
| Payment enrollment | Tokenized via POS API; **no raw card data stored**; PCI scope minimized |
| **Official receipt generation** | Auto PDF on each successful donation (registered orgs); serial-numbered; eligible amount; signatory; emailed + portal |
| **Payment confirmation** | For non-registered orgs — clearly *not* a tax receipt |
| **Annual consolidated receipts** | One year-end receipt per donor (registered orgs) |
| **Receipt cancellation** | On refund: void receipt, retain in audit log, issue marked replacement if needed |
| Donation reporting | Monthly/annual summaries, retention, top donors, fund-wise revenue, failed payments |
| Email & SMS notifications | Confirmations, receipt delivery, billing success/failure, expiring card alerts, announcements |
| Donor communication | Segmented messaging (lapsed, high-value) with **CASL consent + unsubscribe enforced** |
| Failed payment management | Configurable retries (e.g. 3/5/7 days), donor alerts, manual override, plan suspension after max retries |

### 4.3 Donor self-service portal
| Feature | Notes |
|---|---|
| Registration & login | Email/password **or emailed 6-digit code** (passwordless); password reset; `/claim` from a receipt email. No Google login — see [14_AUTHENTICATION.md](14_AUTHENTICATION.md) |
| **Receipt detail capture** | Post-donation name + **address** capture (the donate→address→receipt flow) |
| Donation history | Chronological, filterable; export PDF/CSV |
| Recurring plan management | Pause / modify amount / change frequency / cancel — effective next cycle |
| Payment method management | Tokenized update/add; no raw data |
| Receipt download | Any past receipt; annual consolidated receipt |
| Profile management | Personal details, comms preferences, **CASL consent toggles** |

### 4.4 Payment & billing engine
| Feature | Notes |
|---|---|
| Provider abstraction | `PaymentProvider` interface; **Stripe adapter live**, WeVend adapter built (blocked on merchant ID), mock for dev only; per-org credentials; webhook handling + idempotency — see [13_PAYMENT_GATEWAYS.md](13_PAYMENT_GATEWAYS.md) |
| Secure tokenization | Tokens stored, never raw PAN/bank data |
| Automated recurring billing | Scheduled jobs per plan; configurable day/frequency/amount |
| Failed payment retries | Configurable intervals; donor notified each retry; suspend after max |
| Automated receipts | Generated on successful settlement; voided on refund |
| Multi-currency | CAD primary; others if POS supports |

## 5. Explicitly out of scope (MVP) → see roadmap
Mobile apps, QR/kiosk donations, event campaigns with leaderboards, accounting/CRM
integrations (QuickBooks/Xero/Salesforce/Mailchimp), donation terminal hardware.

## 6. Roadmap (post-MVP)
- **Phase 2:** mobile apps, QR-code giving, kiosk mode, French localization expansion.
- **Phase 3:** event fundraising campaigns, accounting/CRM integrations, hardware terminals.

## 7. Client responsibilities
- **POS / Payment API:** REST docs + sandbox credentials for the tokenization, recurring billing, refund, and webhook events.
- **Branding assets:** platform + per-org logos and colour palettes.
- **Receipt template & legal:** sample CRA-compliant receipt format; authorized signatory name + signature image; charity BN/RR numbers.
- ~~**Onboarding decision:** manual (platform admin) vs self-serve org onboarding.~~ **Decided: self-serve** ([12_ONBOARDING.md](12_ONBOARDING.md)).
- **Hosting:** confirm Canadian-region cloud provider (recommended for Law 25).
- **UAT:** technical rep available; sign-off within agreed window.

## 8. Acceptance criteria (MVP "done")
1. A registered-charity org can onboard, define funds, and enroll a donor in a recurring plan.
2. A donor can give online, enter their address, and receive a **valid CRA-compliant PDF receipt** by email and in their portal.
3. A non-registered org's donor receives a **payment confirmation** (not a tax receipt).
4. Recurring billing runs automatically, retries on failure, and notifies the donor.
5. A refund **voids** the corresponding receipt and records it in the immutable audit log.
6. Annual consolidated receipts generate correctly for a donor with multiple gifts.
7. Marketing emails respect CASL consent and include working unsubscribe.
8. No tenant can read another tenant's data (verified via RLS tests).
