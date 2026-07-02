# KindPath — Project Plan

## 1. Approach
Build the platform-provider abstraction and MockAdapter first so the **entire** donation →
receipt → recurring → refund lifecycle is functional and testable before the client POS API
exists. Compliance (receipts, CASL, audit) is built in from the start, not bolted on.

## 2. Realistic timeline
The original PRD's 5-week plan is optimistic for this scope done compliantly. Realistic MVP:
**~8–10 weeks** with one full-stack dev (faster with two). Phases can overlap.

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **P0 — Foundation** | Wk 1 | Repo, Next.js + Tailwind, PostgreSQL + Prisma, RLS multi-tenancy, auth (3 roles), seed data |
| **P1 — Payment abstraction** | Wk 1–2 | `PaymentProvider` interface + MockAdapter (tokenize/charge/recurring/refund/webhook), idempotency |
| **P2 — Core org platform** | Wk 2–4 | Super admin org mgmt + charity status; org admin donor DB, funds, recurring plans; one-time/manual donations |
| **P3 — Receipts engine** ⚑ | Wk 4–5 | Serial numbering, official receipt + confirmation PDFs, split receipting, void/replace, annual consolidation |
| **P4 — Donor portal + the donate→address→receipt flow** ⚑ | Wk 5–6 | Public branded donation page, address capture, donor self-service, downloads |
| **P5 — Billing engine + notifications** | Wk 6–7 | Cron recurring billing, retry logic, email/SMS, CASL gating, expiring-card alerts |
| **P6 — Dashboards & reporting** | Wk 7–8 | All 3 dashboards, fund-wise + retention reporting, exports |
| **P7 — Subscription billing (SaaS)** | Wk 8 | Org subscription + GST/HST invoices |
| **P8 — QA, security, UAT, deploy** | Wk 8–10 | RLS/cross-tenant tests, OWASP pass, receipt-accuracy QA, Canadian-region prod deploy |

## 3. Milestones (demoable)
- **M1 (end Wk 2):** a mock donation charges successfully and is recorded.
- **M2 (end Wk 5):** a registered org issues a valid CRA-compliant PDF receipt; a non-registered org issues a confirmation.
- **M3 (end Wk 7):** recurring billing runs on a schedule, retries failures, and notifies donors.
- **M4 (end Wk 10):** full end-to-end on Canadian-region production; UAT signed off.

## 4. Definition of done (per the PRD acceptance criteria)
See [01_PRD_v2.md §8](01_PRD_v2.md#8-acceptance-criteria-mvp-done). The receipt correctness and
tenant-isolation criteria are release-blocking.

## 5. Risks & mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Client POS API delayed/undocumented | Blocks payments | MockAdapter de-risks; POS is one adapter behind a stable interface |
| Receipt non-compliance | Charity could be penalized/deregistered | Compliance doc as source of truth; lawyer review of template; snapshot + audit |
| Cross-tenant data leak | Severe | RLS at DB layer + automated isolation tests + app-level RBAC |
| CASL violations on campaigns | Fines | Consent gating enforced at send time; unsubscribe in every message |
| Scope creep (mobile/QR/events) | Timeline slip | Explicitly deferred to roadmap phases 2–3 |
| Timeline optimism | Missed dates | 8–10 wk realistic plan; overlap phases; cut P7 to fast-follow if needed |

## 6. Open items needing client input
1. **POS API:** REST docs + sandbox creds for tokenize/charge/recurring/refund/webhooks (drives P1 → real adapter).
2. **Receipt template & legal:** CRA-compliant sample, authorized signatory name + signature image, BN/RR numbers per pilot org.
3. **Onboarding mode:** manual (admin-created) vs self-serve for MVP.
4. **Hosting:** confirm Canadian region/provider (recommended for Law 25).
5. **Pilot orgs:** 1 registered charity + 1 non-registered org for realistic UAT.
6. **Email/SMS providers:** confirm Resend + Twilio/MSG91 accounts.

## 7. Immediate next steps (when you give the go)
1. Scaffold the repo (Next.js 14 + Tailwind + Prisma + PostgreSQL) with the 3-role auth shell.
2. Implement RLS multi-tenancy + seed a registered + non-registered demo org.
3. Build the `PaymentProvider` interface + MockAdapter.
4. Stand up the donate→address→receipt flow end-to-end against the mock, producing a real PDF.

That sequence proves the riskiest, most differentiating parts (compliance + payment abstraction)
first, while everything else builds around a working core.
