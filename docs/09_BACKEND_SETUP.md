# KindPath — Backend & Local Setup

The backend foundation: PostgreSQL + Prisma, Row-Level Security multi-tenancy, JWT auth for
all three principal types, and the payment-provider abstraction.

## 1. Prerequisites
- Node 20+ and npm
- Docker Desktop (for local Postgres)

## 2. First-time setup
```bash
npm install

# 1. Start Postgres (port 5433 to avoid clashing with a local 5432)
docker run -d --name kindpath-pg \
  -e POSTGRES_USER=kindpath -e POSTGRES_PASSWORD=kindpath_dev_pw \
  -e POSTGRES_DB=kindpath -p 5433:5432 postgres:16-alpine

# 2. Create the non-superuser app role (RLS is enforced for this role)
docker exec -i kindpath-pg psql -U kindpath -d kindpath <<'SQL'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='kindpath_app') THEN
    CREATE ROLE kindpath_app LOGIN PASSWORD 'app_dev_pw';
  END IF;
END $$;
GRANT CONNECT ON DATABASE kindpath TO kindpath_app;
GRANT USAGE ON SCHEMA public TO kindpath_app;
SQL

# 3. Apply migrations (as superuser), RLS policies, then seed
npm run db:migrate     # prisma migrate dev, using ADMIN_DATABASE_URL
npm run db:rls         # applies prisma/sql/rls.sql (policies + grants)
npm run db:seed        # demo orgs, donors, donations, receipts

# 4. Run
npm run dev            # http://localhost:3000
```

## 3. Environment (`.env`)
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | App-role connection (`kindpath_app`). **RLS enforced.** Used by the running app. |
| `ADMIN_DATABASE_URL` | Superuser connection. Migrations, seeding, auth lookups, platform/global ops. |
| `AUTH_SECRET` | HMAC key for signing session JWTs. |
| `AUTH_COOKIE` | Session cookie name. |
| `PAYMENT_PROVIDER` | `mock` / `mock-hosted` locally. **Production refuses both** (`src/lib/env.ts`); use `stripe` or `wevend`. |
| `CREDENTIALS_KEY` | Encrypts per-org gateway credentials. Falls back to `AUTH_SECRET` locally only. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Empty locally → emails are printed to the console (`simulated: true`). |
| `UPSTASH_REDIS_REST_URL/TOKEN` | Rate limiter; in-memory Map when unset (fine locally, not on Vercel). |

> This table is the **local** minimum. The complete, authoritative list is `.env.example` and
> [10_DEPLOYMENT.md](10_DEPLOYMENT.md) §5 (production) — do not maintain a third copy here.

## 4. Seeded login credentials (password: `Password123!`)
| Role | Email | Lands on |
|------|-------|----------|
| Platform super admin | `admin@kindpath.app` | `/admin` |
| Org admin (registered charity) | `jane@stmarys.org` | `/dashboard` |
| Org admin (non-registered) | `admin@riverside.org` | `/dashboard` |
| Donor (self-service) | `aanya@example.com` | `/portal` |

## 5. How multi-tenancy is enforced
1. **App connects as `kindpath_app`** (non-superuser) → subject to RLS.
2. Tenant data is read/written via `withTenant(orgId, cb)` ([src/lib/tenant.ts](../src/lib/tenant.ts)),
   which runs `set_config('app.current_org_id', orgId, true)` inside a transaction.
3. RLS policies ([prisma/sql/rls.sql](../prisma/sql/rls.sql)) restrict every tenant table to
   `org_id = current_org_id()`. **No context set → zero rows (deny by default).**
4. **Defense in depth:** app code also scopes by `orgId`, and pre-tenant work (auth lookups,
   platform admin ops, seeding) uses the `adminDb` superuser client which bypasses RLS by design.

> Verified: as `kindpath_app`, `SELECT count(*) FROM donors` returns 0 with no context, and only
> the active org's rows once `app.current_org_id` is set — even though the DB holds multiple orgs.

## 6. Auth model

> Superseded by [14_AUTHENTICATION.md](14_AUTHENTICATION.md) (four principals, TOTP, emailed codes, `/login/choose`). The notes below describe only the original password path.

- Single session cookie (HTTP-only, signed JWT) for all three principal types; `kind` claim
  (`platform` | `org` | `donor`) routes to the right portal.
- `src/lib/auth/`: `password.ts` (bcrypt), `jwt.ts` (jose HS256), `session.ts` (cookie),
  `guards.ts` (`requireOrgUser` / `requirePlatformAdmin` / `requireDonor`).
- `src/middleware.ts` guards `/admin`, `/dashboard`, `/portal` and redirects by `kind`.
- Login/signup are server actions in `src/app/(auth)/actions.ts`.

## 7. Payment abstraction (your POS plugs in here)

> Superseded by [13_PAYMENT_GATEWAYS.md](13_PAYMENT_GATEWAYS.md). Stripe and WeVend adapters exist; orgs connect their own accounts. The sketch below is the original interface description.

- `src/lib/payments/provider.ts` — the `PaymentProvider` interface (the only seam).
- `src/lib/payments/mock-adapter.ts` — in-memory simulator (charges ending in `.01` decline,
  so failed-payment/retry flows are testable). No network.
- `src/lib/payments/index.ts` — `getPaymentProvider()` factory. Add a `client-pos` case for your
  POS adapter; no call sites change.

## 8. Useful scripts
| Command | Does |
|---------|------|
| `npm run dev` | Start the app |
| `npm run db:migrate` | Create/apply a migration (superuser) |
| `npm run db:rls` | (Re)apply RLS policies + grants |
| `npm run db:seed` | Reset + seed demo data |
| `npm run db:studio` | Prisma Studio |
| `npm run build` | Production build / typecheck |
