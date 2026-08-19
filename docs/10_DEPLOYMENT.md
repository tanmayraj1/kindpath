# KindPath — Deploy to Production

Recommended stack (simplest path, Canadian-friendly):
- **App host:** Vercel (native Next.js)
- **Database:** Neon Postgres — region **AWS `ca-central-1` (Montréal)** for Law 25 residency
- **Email:** Resend (verified domain)
- **Payments:** your POS adapter — see §8. *The app currently uses the MockAdapter; real money requires the real adapter.*

> ⚠️ Before taking REAL donations: have a Canadian charity lawyer review the receipt template,
> wire the real payment adapter, and complete the §9 checklist.

---

## 1. Put the code on GitHub
```bash
cd /Users/tanmayraj/Documents/KindPath
git init
git add -A
git commit -m "KindPath initial"
# create an EMPTY repo on github.com first, then:
git remote add origin https://github.com/<you>/kindpath.git
git branch -M main
git push -u origin main
```
`.env` is git-ignored — secrets never get committed. Good.

## 2. Provision the production database (Neon)
1. Create a Neon project in **ca-central-1**. You get an owner role (e.g. `neondb_owner`) and a database.
2. In the Neon SQL editor, create the non-superuser **app role** (runtime, RLS-enforced):
   ```sql
   CREATE ROLE kindpath_app LOGIN PASSWORD 'a-strong-app-password';
   GRANT CONNECT ON DATABASE neondb TO kindpath_app;
   GRANT USAGE ON SCHEMA public TO kindpath_app;
   ```
3. Note two connection strings (Neon gives **pooled** and **direct** URLs):
   - **Owner/direct** (for migrations) → use as `ADMIN_DATABASE_URL`
   - **App role, pooled** (`...-pooler...` host, add `?sslmode=require`) → use as `DATABASE_URL`
   - Build the app-role pooled URL by swapping the user/password to `kindpath_app`.

## 3. Run migrations + RLS + create your admin (from your machine, against prod)
```bash
# point at the production OWNER connection just for these one-off setup steps
export ADMIN_DATABASE_URL="postgres://<owner>:<pw>@<host>/<db>?sslmode=require"

npm run db:deploy          # applies all migrations (uses ADMIN_DATABASE_URL)

# apply RLS policies + grants to kindpath_app (psql, or paste prisma/sql/rls.sql into Neon SQL editor)
psql "$ADMIN_DATABASE_URL" -f prisma/sql/rls.sql

# create YOUR real super-admin (no demo seed in prod)
ADMIN_EMAIL="you@yourdomain.com" ADMIN_NAME="You" ADMIN_PASSWORD="<strong-password>" \
  npx tsx scripts/create-admin.ts
```
Do **not** run `npm run db:seed` in production (that's demo data).

> ⚠️ **Subscribe the Stripe webhook endpoint to exactly four events:**
> `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`,
> `refund.created` — pointed at `https://yourdomain.com/api/webhooks/pos`.
> Anything else is acknowledged and ignored (see `UnsupportedWebhookEvent`), so
> "send me everything" is safe but noisy.

## 4. Set up email (Resend)
1. Create a Resend account, **verify your sending domain** (DNS records).
2. Create an API key → `RESEND_API_KEY`.
3. Set `EMAIL_FROM="KindPath <receipts@yourdomain.com>"` (must be on the verified domain).

## 5. Deploy on Vercel
1. vercel.com → **Add New → Project → import your GitHub repo**. Framework auto-detects Next.js.
2. Add **Environment Variables** (Production), then Deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | app-role **pooled** Neon URL (`kindpath_app`) |
| `ADMIN_DATABASE_URL` | owner/direct Neon URL (used by cron/billing + admin ops) |
| `AUTH_SECRET` | a 32-byte random secret (generate one fresh) |
| `AUTH_COOKIE` | `kindpath_session` |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` |
| `RESEND_API_KEY` | from Resend |
| `EMAIL_FROM` | `KindPath <receipts@yourdomain.com>` |
| `CONTACT_TO` | where demo requests go, e.g. `sales@yourdomain.com` |
| `PAYMENT_PROVIDER` | **`stripe` or `wevend`** — see the warning below |
| `CRON_SECRET` | a random secret (Vercel cron sends it automatically) |
| `CREDENTIALS_KEY` | **required.** Encrypts each org's gateway credentials |
| `UPSTASH_REDIS_REST_URL` | **required on Vercel** — see the warning below |
| `UPSTASH_REDIS_REST_TOKEN` | **required on Vercel** |
| `SENTRY_DSN` | optional; without it errors are console-logged only |
| `KINDPATH_GST_NUMBER` | your GST/HST number, printed on KindPath's own invoices |
| `BILLING_CONTACT_EMAIL` | where customers ask about an invoice |

> Generate secrets: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

> **Check the deployment before hunting anything else: `curl https://yourdomain.com/api/ready`.**
> It answers with `{"ready": true}` or a 503 naming every variable still missing.
>
> This exists because the failure mode is otherwise unreadable. `assertEnv()` runs
> at the top of `src/lib/db.ts`, so a missing variable throws while that module is
> being *imported* — before any route handler, and before any error boundary. The
> browser gets a bare 500 on every database-touching page while `/` and `/login`
> keep returning 200, which looks like a routing or DNS problem and is neither.
> `/api/ready` imports nothing but `src/lib/env.ts` precisely so it still answers
> on an instance that cannot boot. It reports variable *names* only, never values.
>
> Note that `PAYMENT_PROVIDER=stripe` pulls `STRIPE_SECRET_KEY` and
> `STRIPE_WEBHOOK_SECRET` in with it, so expect a second round of missing names
> after you set the provider. Re-run the probe after each redeploy until it's green.

> ⚠️ **`PAYMENT_PROVIDER` must not be `mock`.** `src/lib/env.ts` refuses to boot
> in production with `mock`, `mock-hosted`, or unset — the simulated gateway's
> webhook verifier accepts unsigned JSON, which would make `/api/webhooks/pos` an
> unauthenticated way to void a charity's official tax receipts. The build still
> succeeds (env validation is deliberately downgraded during the build so CI needs
> no secrets), so a wrong value surfaces as a 500 on the first real request.

> ⚠️ **`CREDENTIALS_KEY` is not optional in production**, despite what
> `.env.example` used to imply. It falls back to `AUTH_SECRET`, which couples
> every org's gateway-credential decryption to session signing: rotating
> `AUTH_SECRET` would then destroy every org's stored merchant credentials.

> ⚠️ **Set the Upstash pair.** Without them the rate limiter falls back to an
> in-memory `Map`, and on Vercel every concurrent lambda has its own — so the
> effective login limit becomes 10/min × instance count, and brute-force
> protection is essentially absent. This applies to login, 2FA, forgot-password,
> donation charges and the webhook endpoint.

### Why `vercel.json` looks the way it does

`vercel.json` is schema-validated by Vercel and **rejects any key it doesn't
recognise** — including comment-style keys like `_comment`. A build that fails
with *"should NOT have additional property"* means someone added one. Keep the
reasoning here instead:

- **`"regions": ["yul1"]`** — donor PII is processed where the function runs, not
  only where it is stored. This document makes an explicit Quebec Law 25
  residency claim, and Vercel defaults to `iad1` (Washington), so functions are
  pinned to Montreal.
- **`/api/cron/campaigns` runs daily, not hourly** — the Hobby plan permits
  once-daily cron only, and a rejected or silently-disabled schedule would strand
  every bulk send at its first 50 recipients with no error anywhere. On Pro,
  raise it to `0 * * * *` for same-hour delivery.

The build runs `vercel-build`, which applies migrations and RLS policies before
building. This is deliberate: the previous documented order was `git push` (which
auto-deploys) and *then* `npm run db:deploy` by hand, i.e. it shipped code ahead
of its own schema. A missing `ADMIN_DATABASE_URL` now fails the deploy instead of
producing a running site against a stale database.

## 6. Recurring-billing cron
`vercel.json` already declares a daily job hitting `/api/cron/billing`. Vercel automatically sends
`Authorization: Bearer $CRON_SECRET`, which the route verifies. Confirm it under
**Vercel → Project → Settings → Cron Jobs** after the first deploy.
(Adjust the schedule in `vercel.json`; default `0 9 * * *` = 09:00 UTC daily.)

## 7. Custom domain + SSL
Vercel → **Settings → Domains** → add `yourdomain.com`, set the DNS records Vercel shows. SSL is automatic.
Update `NEXT_PUBLIC_APP_URL` to the final domain and redeploy.

## 8. Wire real payments (when ready for real money)
Implement `PaymentProvider` for your POS in `src/lib/payments/your-pos-adapter.ts`, register it in
`src/lib/payments/index.ts` under a new `PAYMENT_PROVIDER` value, and set that env var. No other code changes.
Use the gateway's **hosted fields** so card data never touches the server (keeps PCI scope minimal).

## 9. Pre-launch checklist
- [ ] Real super-admin created; demo accounts NOT seeded in prod
- [ ] `AUTH_SECRET` / `CRON_SECRET` are fresh production values
- [ ] Receipt template reviewed by a Canadian charity lawyer; org BN/RR numbers entered
- [ ] Real payment adapter wired + tested in the gateway's sandbox
- [ ] Resend domain verified; send a live test receipt
- [ ] DB automated backups enabled (Neon: PITR)
- [ ] Error monitoring (e.g. Sentry) + uptime check
- [ ] Test end-to-end on the live domain: donate → address → receipt PDF → appears in dashboards
- [ ] Verify a non-admin cannot read another org's data (RLS) on prod

## Updating after launch
```bash
git add -A && git commit -m "..." && git push    # Vercel auto-deploys
# if you changed the schema:
ADMIN_DATABASE_URL="<owner url>" npm run db:deploy
# then apply any new RLS for new tables (prisma/sql/rls.sql is idempotent)
```
