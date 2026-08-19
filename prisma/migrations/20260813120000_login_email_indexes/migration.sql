-- Indexes for the login lookup.
--
-- `findCandidates` resolves an account by email across donors, volunteers and
-- org_users on every sign-in and every forgot-password request. Every existing
-- index on these tables leads with org_id (`@@unique([org_id, email])`,
-- `@@index([org_id])`), which cannot serve an email-only predicate — so each
-- login was a sequential scan. At the donor volumes the scale work was built
-- for, that is the slowest thing in the application and it is on the auth path.
--
-- These are FUNCTIONAL indexes on lower(email), not plain indexes on email,
-- because email is stored exactly as the donor typed it. A donor who entered
-- "Bob@Example.com" must be able to sign in as "bob@example.com" — matching how
-- every mail provider actually behaves. Pairing lower(email) lookups with a
-- lower(email) index keeps that case-insensitivity indexed rather than turning
-- it into a scan. No backfill is needed and no existing row moves, so there is
-- no risk of colliding with the per-org unique constraint.
--
-- Prisma's schema language cannot express a functional index, which is why this
-- migration is hand-written. `prisma migrate diff` stays clean because these are
-- additive indexes rather than schema changes.
CREATE INDEX IF NOT EXISTS "donors_lower_email_idx"     ON "donors"     (lower("email"));
CREATE INDEX IF NOT EXISTS "volunteers_lower_email_idx" ON "volunteers" (lower("email"));
CREATE INDEX IF NOT EXISTS "org_users_lower_email_idx"  ON "org_users"  (lower("email"));
