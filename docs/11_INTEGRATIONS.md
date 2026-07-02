# KindPath — Live Credentials & Integrations Checklist

What I need from you to connect everything in production. Grouped by system.
**Bold = blocking for launch.** Items marked "(I generate)" you don't provide.

---

## 1. Hosting & database
| Item | What / where | Notes |
|------|--------------|-------|
| **Vercel account** | vercel.com | Connect the GitHub repo; you invite me or share project access |
| **GitHub repo** | github.com | Push access |
| **Postgres (Neon)** | neon.tech, region **ca-central-1** | Owner connection string + app-role password (Law 25 residency) |
| Domain + DNS access | your registrar | To point the domain + verify email |

## 2. Auth & app secrets — (I generate)
`AUTH_SECRET`, `CRON_SECRET` — random values I create; you just paste them into Vercel. No action.

## 3. Email — Resend
| Item | Notes |
|------|-------|
| **Resend API key** | resend.com → API Keys |
| **Verified sending domain** | e.g. `kindpath.app` — add the DNS records Resend gives |
| **From address** | `receipts@yourdomain.com` (on the verified domain) |
| Contact inbox | where "Book a demo" requests go, e.g. `sales@yourdomain.com` |

## 4. SMS (optional — only if you enable the SMS feature) — Twilio or MSG91
- Account SID + Auth Token (Twilio) **or** API key (MSG91)
- A sending phone number / sender ID (Canada A2P 10DLC registration may be required)

## 5. Payments / your POS  ⭐ (the big one)
KindPath talks to one `PaymentProvider` adapter. To build your POS adapter I need its API spec.

**API & environments**
- [ ] **API documentation** (PDF or URL) for the POS / payment + recurring-billing API
- [ ] **Sandbox base URL** + **Production base URL**
- [ ] **Authentication**: API key / secret, or OAuth `client_id` + `client_secret` (sandbox **and** prod)
- [ ] **Merchant / account / terminal IDs** if required per request

**Capabilities I need to map (tell me which exist + the endpoints)**
- [ ] **Tokenize** a card/bank method (ideally **hosted fields / iframe** so card data never touches our server — give me the public/publishable key + embed snippet)
- [ ] **Charge** a token (one-time)
- [ ] **Recurring / subscription** billing (or we drive it ourselves via charge — confirm)
- [ ] **Refund** (full + partial)
- [ ] **Webhooks**: events for payment succeeded/failed, refund, card expiring — plus the **webhook signing secret** and the URL format you expect us to register (`https://yourdomain.com/api/webhooks/pos`)

**Money/settlement**
- [ ] Settlement currency (CAD), supported currencies
- [ ] Fee structure (for the "cover-the-fees" math)
- [ ] **Sandbox test cards** / test credentials

> Until these arrive, KindPath runs on the built-in MockAdapter (full flow works, no real money).
> Swapping in your POS is a single adapter file + one env var — no other code changes.

## 6. Invoice / receipt printer (in-person printing) 🖨️
Two distinct documents — decide what prints where:
- **Official CRA donation receipt** = full-page PDF (already generated, emailed). Prints fine on any
  normal/office printer via the browser print dialog — **no integration needed**.
- **In-venue thank-you / payment slip** at a kiosk = usually a **thermal receipt printer**.

For the thermal/kiosk printer I need:
- [ ] **Make & model** (e.g. Epson TM-m30/TM-T88, Star TSP100/mC-Print)
- [ ] **Connection**: network/Ethernet/Wi-Fi (has an IP), USB (to the kiosk device), or cloud
  (Star **CloudPRNT** / Epson **ePOS / Server Direct Print**)
- [ ] **Where it lives**: at the kiosk on the venue's local network (browser prints to it) vs. a
  central printer (server pushes the job)
- [ ] Paper width (58mm vs 80mm)
- [ ] Whether the slip should be the full official receipt or a short "thank-you + receipt #" with
  the PDF emailed

Recommended default: **Epson TM-m30 (Wi-Fi) using ePOS-Print from the kiosk browser** — clean, no
server printing infra, and the official PDF still goes by email.

## 7. Compliance / org onboarding data (per organization) — required to issue real receipts
- [ ] Charity **legal name + address** as on file with the CRA
- [ ] **CRA registration number** (`BN/RR`, e.g. `123456789 RR 0001`)
- [ ] **Authorized signatory** name + a **signature image** (PNG, transparent)
- [ ] Receipt locality (place issued) + logo + brand colour
- [ ] **Lawyer-reviewed receipt wording** (Canadian charity counsel)

## 8. Monitoring (recommended) — Sentry
- [ ] Sentry DSN (free tier) for production error tracking

---

## Who provides what — quick summary
| You provide now (blocking) | I generate / build |
|---|---|
| Vercel + GitHub + Neon access | AUTH_SECRET, CRON_SECRET |
| Resend key + verified domain | All env wiring + deploy config |
| **POS API docs + sandbox + prod creds + webhook secret** | The POS adapter + webhook handler |
| Printer make/model + connection | The print integration |
| Each org's BN/RR + signatory + signature | Receipt generation (done) |
| Domain + DNS | Domain wiring |
