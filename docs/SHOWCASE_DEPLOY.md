# KindPath — Showcase Deploy (Vercel + Neon)

A **demo** deploy: populated seed data, free `*.vercel.app` domain, mock payments, no lawyer/email
setup. For a real money-taking launch, use `10_DEPLOYMENT.md` instead.

## 0. Push code to GitHub
Repo is already initialized + committed locally. Create an **empty** repo on github.com, then:
```bash
cd /Users/tanmayraj/Documents/KindPath
git remote add origin https://github.com/<you>/kindpath.git
git branch -M main
git push -u origin main
```

## 1. Database — Neon (ca-central-1)
1. neon.tech → new project, region **AWS ca-central-1 (Montréal)**. You get an owner role (e.g.
   `neondb_owner`) + a `neondb` database.
2. Neon SQL editor — create the RLS-enforced runtime role:
   ```sql
   CREATE ROLE kindpath_app LOGIN PASSWORD 'a-strong-app-pw';
   GRANT CONNECT ON DATABASE neondb TO kindpath_app;
   GRANT USAGE ON SCHEMA public TO kindpath_app;
   ```
3. From the Neon dashboard, grab two connection strings (add `?sslmode=require`):
   - **Owner, DIRECT** (non-pooler host) → this is `ADMIN_DATABASE_URL`
   - **App-role, POOLED** (`-pooler` host; swap user/pw to `kindpath_app`) → this is `DATABASE_URL`

## 2. Migrate + RLS + seed + admin (one-off, from your machine)
```bash
export ADMIN_DATABASE_URL="postgres://<owner>:<pw>@<direct-host>/neondb?sslmode=require"
export DATABASE_URL="$ADMIN_DATABASE_URL"          # seed falls back to this

npm run db:deploy                                   # apply migrations
psql "$ADMIN_DATABASE_URL" -f prisma/sql/rls.sql    # RLS policies + grants (or paste into Neon SQL editor)
npm run db:seed                                     # DEMO data (fine for showcase)
```

### ⚠️ Neon RLS check — the one thing that silently breaks login
Tenant tables use `FORCE ROW LEVEL SECURITY`. Locally, `adminDb` connects as a Postgres **superuser**
so it bypasses RLS (auth lookups, cron, seed all rely on this). Neon has **no superuser**, so the owner
role must **bypass RLS** or login/seeding returns 0 rows. Verify — run against `ADMIN_DATABASE_URL`
with **no** `app.current_org_id` set:
```bash
psql "$ADMIN_DATABASE_URL" -c "SELECT count(*) FROM organizations;"
```
- Returns **2+** (the seeded orgs) → ✓ done, adminDb bypasses RLS.
- Returns **0** → the owner is subject to forced RLS. Fix and re-check:
  ```sql
  ALTER ROLE <owner-role> BYPASSRLS;
  ```
  (If Neon rejects that, tell me — there's a fallback.)

## 3. Vercel
1. vercel.com → **Add New → Project** → import the GitHub repo. Next.js auto-detected; build command
   `prisma generate && next build` is already set.
2. **Environment Variables** (Production) — add all of these, then Deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | app-role **pooled** Neon URL (`kindpath_app`) |
| `ADMIN_DATABASE_URL` | owner **direct** Neon URL |
| `AUTH_SECRET` | (generated — see chat) |
| `AUTH_COOKIE` | `kindpath_session` |
| `NEXT_PUBLIC_APP_URL` | set after first deploy to the real `https://…vercel.app`, then redeploy |
| `PAYMENT_PROVIDER` | `mock` |
| `CRON_SECRET` | (generated — see chat) |
| `CONTACT_TO` | your email (optional; demo-request form) |

Email is intentionally omitted → the app logs receipts to the function console instead of sending
(PDFs still generate + download fine). Add `RESEND_API_KEY` + `EMAIL_FROM` later for real sends.

3. After the first deploy, copy the assigned `https://<project>.vercel.app`, put it in
   `NEXT_PUBLIC_APP_URL`, and redeploy (so QR codes / receipt links use the right absolute URL).

## 4. Verify the live showcase
- Visit the URL → marketing site loads.
- Sign in with a seeded demo account (password `Password123!`):
  - `jane@stmarys.org` → `/dashboard` (registered charity, branded, has volunteers/pledges)
  - `admin@kindpath.app` → `/admin` (platform God Mode)
  - `aanya@example.com` → `/portal` (donor) · `grace@example.com` → `/volunteer`
- Make a demo donation on `/give/st-marys` (any amount **not** ending in `.01`; `.01` simulates a
  decline) → capture details → receipt PDF downloads.
- Cron: **Settings → Cron Jobs** shows the daily `/api/cron/billing` (Vercel sends the `CRON_SECRET`).

## Notes
- **Cron on Hobby plan**: once-daily (`0 9 * * *`) is allowed — no Pro plan needed for the showcase.
- **Redeploys**: `git push` → Vercel auto-deploys. Schema changes → rerun `npm run db:deploy` +
  re-apply `prisma/sql/rls.sql` (idempotent).
- **Reset the demo** anytime: `npm run db:seed` (wipes + reinserts demo data — never run against a
  DB with real data).
