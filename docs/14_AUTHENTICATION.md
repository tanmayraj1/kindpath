# 14 — Authentication (as built)

> Replaces the "NextAuth/JWT + SMS OTP" descriptions in 03 §2, 04, 05 §A1 and 09 §6.
> Last verified against `734d305`.

## 1. Principals and sessions

Four principals, one cookie. `src/lib/auth/jwt.ts` + `src/lib/auth/session.ts`:

| Principal (`kind`) | Who | Tenant | Guard |
|---|---|---|---|
| `platform` | KindPath super-admins (God Mode, `/admin`) | none | `requirePlatformAdmin` |
| `org` | charity staff (`org_admin` / `staff`) | `orgId` | `requireOrgUser` / `requireOrgAdmin` |
| `donor` | a donor's portal account (`/portal`) | `orgId` | `requireDonor` |
| `volunteer` | volunteer pass (`/volunteer`) | `orgId` | `requireVolunteer` |

- Cookie `kindpath_session` (override with `AUTH_COOKIE`), **jose HS256**, signed
  with `AUTH_SECRET`, 7-day `maxAge`, httpOnly. Claims: `sub`, `kind`, `role`,
  `orgId`, `name`, `email`, `v` (token version — bumping `tokenVersion` on the user
  row revokes every session, `src/lib/auth/revocation.ts`).
- **`AUTH_SECRET` must never be rotated in production.** It signs every live
  session *and* every HMAC-signed receipt link already sitting in donors' inboxes
  (`src/lib/pass-links.ts`), and outside production it is the fallback for
  `CREDENTIALS_KEY`.
- Not NextAuth. No Firebase. See §5 for why.

## 2. Email is unique per organization

`@@unique([orgId, email])` on `Donor`, `Volunteer` and `OrgUser`
(`prisma/schema.prisma`). The same person can be a donor at two temples and staff
at a third, with the same address. Every login path therefore starts with
`findCandidates(email)` (`src/lib/auth/candidates.ts`), which returns every
account at that address across principals and orgs; when there is more than one,
the user lands on **`/login/choose`** (an account chooser fed by a short-lived
ticket, `createAccountTicket` in `src/lib/auth/account-ticket.ts`) before a session is minted.

## 3. Staff: password + TOTP

- `/login` → `loginAction` (10/min/IP). bcrypt password hash
  (`src/lib/auth/password.ts`), lockout after repeated failures
  (`src/lib/auth/lockout.ts`), forced `/change-password` when a temporary password
  is set.
- Optional TOTP second factor (`src/lib/auth/totp.ts`): enrol at
  `/dashboard/security`, challenge at `/login/2fa` (10/min/IP). Recovery codes.
- Password reset: `/forgot` → `requestPasswordReset` (5/15 min/IP, 3/hour/email)
  → `/reset`. Tokens in `src/lib/auth/password-reset.ts`: hashed at rest,
  single-use, purpose-scoped (`reset` 1 h, `invite` 7 d, `verify` 7 d), superseding.
- Team invites reuse the reset primitive (`src/lib/auth/invite.ts`).
- Org admins and platform admins **do not** get the email-code path below — an
  emailed code is only as strong as the inbox, and an org admin can void tax
  receipts and email every donor.

## 4. Donors and volunteers: password *or* email code

Donor accounts are created by donating; nothing sets a password on them, so
`/claim` (posts to `requestPasswordReset`) was the original door. It is a second
email hop. The code path removes it.

**`/login/code`** (`src/app/(auth)/login/code/page.tsx`, form
`src/components/auth/login-code-form.tsx`, actions `requestLoginCodeAction` /
`verifyLoginCodeAction` in `src/app/(auth)/actions.ts`, primitive
`src/lib/auth/login-code.ts`, model `LoginCode` → table `login_codes`).

| Property | Value | Why |
|---|---|---|
| Eligible | `donor`, `volunteer` only (`CODE_ELIGIBLE`) | §3 |
| Keyed by | **email**, not principal | one code unlocks every account at the address → chooser |
| Code | 6 digits from `randomInt` (rejection-sampled, no modulo bias) | |
| Stored | `sha256("{email}:{code}")` — email bound into the digest | a hash can't replay across addresses |
| TTL | 10 min (`CODE_TTL_MS`) | |
| Attempts | **5 on the DB row** (`attemptCount`, counted *before* the answer; exhaustion burns the code) | `rateLimit()` fails **open** on a Redis error — the DB counter is the real ceiling |
| Supersession | issuing a new code voids outstanding ones | "resend ×3" must not triple the guess surface |
| Rate limits | request: 10/min/IP + 5/15 min/email; verify: 20/min/IP | first gate only |
| Enumeration | request returns `{ sent: true }` identically for unknown and staff addresses; verify returns `invalid` for "no code" and "wrong code" alike | the screen is byte-identical either way |
| After verify | candidates are re-resolved server-side; one → `completeLogin`; several → `/login/choose` | |
| Purge | `purgeExpiredLoginCodes` runs on the daily billing cron | hygiene, not security — `consume` checks `expiresAt` |

Tests: `src/lib/auth/login-code.test.ts` (11 cases: shape, distribution, replay,
case-insensitivity, enumeration-safe invalid, lock + correct-code-dies, expiry,
supersession, cross-address refusal, paste tolerance).

Password login remains available to donors who set one; the code sits alongside.

## 5. Why not Firebase Auth (or any hosted IdP)

Asked during Phase C and answered no, for reasons worth keeping:

1. **Identity is per-org here.** Firebase (and most IdPs) treat an email as one
   global user. Our schema makes `(orgId, email)` the identity and the chooser is a
   first-class step. Mapping that onto a global UID means a join table, custom
   claims per org, and re-implementing the chooser anyway.
2. **Sessions are ours.** RLS (`withTenant`) is keyed on claims we mint; an external
   token would still have to be exchanged for ours.
3. **Residency.** Auth data would leave the Canadian region we otherwise keep it in
   (`docs/02_COMPLIANCE.md` §3).
4. What we actually needed — passwordless for donors — is ~200 lines on a primitive
   that already existed for password reset.

## 6. Where each piece lives

```
src/lib/auth/
  jwt.ts            sign/verify (HS256, 7d)
  session.ts        cookie read/write, createSession
  guards.ts         requireSession / requireOrgUser / requireOrgAdmin / requirePlatformAdmin / requireDonor / requireVolunteer
  candidates.ts     findCandidates(email) across principals + orgs, withPassword()
  password.ts       bcrypt
  account-ticket.ts chooser tickets for /login/choose
  lockout.ts        failure counting
  totp.ts           TOTP + recovery codes
  password-reset.ts hashed single-use purpose-scoped tokens (also invites)
  invite.ts         team invites
  email-verification.ts
  login-code.ts     email one-time codes (donor/volunteer)
  revocation.ts     tokenVersion bump
  portals.ts        safeNext / portal routing
src/app/(auth)/     login, login/2fa, login/choose, login/code, signup, verify, forgot, reset, claim, change-password
```
