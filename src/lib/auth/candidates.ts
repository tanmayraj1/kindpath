import "server-only";
import { Prisma } from "@prisma/client";
import { adminDb } from "@/lib/db";
import type { SessionClaims } from "./jwt";

/**
 * Resolving an email address to the account(s) it can sign into.
 *
 * The hard fact this module exists for: **an email is not an identity here.**
 * `Donor`, `Volunteer` and `OrgUser` are each `@@unique([orgId, email])`, so one
 * address can legitimately belong to several rows across several organizations —
 * a person who gives to two charities, or who volunteers at the parish she also
 * donates to. Only `PlatformAdmin.email` is globally unique.
 *
 * The previous `findCandidate` returned the FIRST match by table precedence
 * (platform → org → volunteer → donor) using an unordered `findFirst`. Two
 * consequences, both live:
 *
 *   * A treasurer who donates to her own parish could never reach `/portal` —
 *     the org branch always won, so her donor account was unreachable forever.
 *   * A donor with rows at two organizations got whichever row Postgres happened
 *     to return, which can differ between calls. A silent wrong-tenant login.
 *
 * So collection is now exhaustive and deterministically ordered, and choosing
 * between matches is deferred until AFTER the password has been verified — see
 * `loginAction`. Nothing about which organizations an address belongs to is
 * disclosed to anyone who has not already proven the password against them.
 */

export type Candidate = {
  kind: SessionClaims["kind"];
  id: string;
  /** Null for a donor who exists but has never set a password. */
  passwordHash: string | null;
  claims: SessionClaims;
  account: { failedLoginCount: number; lockedUntil: Date | null };
  mustChangePassword: boolean;
  needsTwoFactor: boolean;
  /** Organization name, shown only in the post-authentication account chooser. */
  orgName?: string;
};

/**
 * Upper bound on accounts considered for one address.
 *
 * Each candidate costs a bcrypt verification, so an address deliberately
 * attached to hundreds of organizations would otherwise be a cheap way to make
 * the login endpoint do expensive work.
 */
const MAX_CANDIDATES = 5;

/**
 * Ids whose email matches case-insensitively.
 *
 * Raw SQL because the predicate has to be `lower(email) = lower($1)` to hit the
 * functional indexes added in `20260813120000_login_email_indexes`. Prisma's
 * `mode: "insensitive"` compiles to `ILIKE`, which those indexes cannot serve —
 * it would silently be a sequential scan on the auth path.
 */
async function idsByEmail(table: "donors" | "volunteers" | "org_users", email: string) {
  const sql =
    table === "donors"
      ? Prisma.sql`SELECT id FROM donors WHERE lower(email) = lower(${email}) LIMIT ${MAX_CANDIDATES}`
      : table === "volunteers"
        ? Prisma.sql`SELECT id FROM volunteers WHERE lower(email) = lower(${email}) LIMIT ${MAX_CANDIDATES}`
        : Prisma.sql`SELECT id FROM org_users WHERE lower(email) = lower(${email}) LIMIT ${MAX_CANDIDATES}`;
  const rows = await adminDb.$queryRaw<{ id: string }[]>(sql);
  return rows.map((r) => r.id);
}

/**
 * Every account this email could sign into, in a stable order.
 *
 * Ordering is table precedence then `createdAt` ascending, so the same address
 * produces the same list on every call — the property the old `findFirst` was
 * missing.
 *
 * Password-less donors ARE included. They cannot authenticate (no hash to
 * verify), but `requestPasswordReset` needs to see them: a donor who has given
 * but never set a password is exactly who needs a link, and filtering them out
 * here is what made the donor portal unreachable.
 */
export async function findCandidates(email: string): Promise<Candidate[]> {
  const out: Candidate[] = [];

  const platform = await adminDb.platformAdmin.findUnique({ where: { email } });
  if (platform) {
    out.push({
      kind: "platform",
      id: platform.id,
      passwordHash: platform.passwordHash,
      claims: {
        sub: platform.id,
        kind: "platform",
        role: platform.role,
        name: platform.name,
        email: platform.email,
        v: platform.tokenVersion,
      },
      account: { failedLoginCount: platform.failedLoginCount, lockedUntil: platform.lockedUntil },
      mustChangePassword: platform.mustChangePassword,
      needsTwoFactor: false,
    });
  }

  const [orgIds, volIds, donorIds] = await Promise.all([
    idsByEmail("org_users", email),
    idsByEmail("volunteers", email),
    idsByEmail("donors", email),
  ]);

  if (orgIds.length) {
    const rows = await adminDb.orgUser.findMany({
      where: { id: { in: orgIds }, status: "active" },
      orderBy: { createdAt: "asc" },
      include: { org: { select: { name: true } } },
    });
    for (const u of rows) {
      out.push({
        kind: "org",
        id: u.id,
        passwordHash: u.passwordHash,
        claims: {
          sub: u.id,
          kind: "org",
          role: u.role,
          orgId: u.orgId,
          name: u.name,
          email: u.email,
          v: u.tokenVersion,
        },
        account: { failedLoginCount: u.failedLoginCount, lockedUntil: u.lockedUntil },
        mustChangePassword: u.mustChangePassword,
        needsTwoFactor: !!u.totpEnabledAt,
        orgName: u.org.name,
      });
    }
  }

  if (volIds.length) {
    const rows = await adminDb.volunteer.findMany({
      where: { id: { in: volIds }, status: "active", passwordHash: { not: null } },
      orderBy: { createdAt: "asc" },
      include: { org: { select: { name: true } } },
    });
    for (const v of rows) {
      out.push({
        kind: "volunteer",
        id: v.id,
        passwordHash: v.passwordHash,
        claims: {
          sub: v.id,
          kind: "volunteer",
          role: "volunteer",
          orgId: v.orgId,
          name: `${v.firstName} ${v.lastName}`,
          email: v.email,
          v: v.tokenVersion,
        },
        account: { failedLoginCount: v.failedLoginCount, lockedUntil: v.lockedUntil },
        mustChangePassword: v.mustChangePassword,
        needsTwoFactor: false,
        orgName: v.org.name,
      });
    }
  }

  if (donorIds.length) {
    const rows = await adminDb.donor.findMany({
      // An erased donor is not an account. Their email was rewritten to a
      // reserved-domain placeholder anyway, but the filter is what guarantees a
      // scrubbed record can never be signed into or sent a link.
      where: { id: { in: donorIds }, anonymizedAt: null },
      orderBy: { createdAt: "asc" },
      include: { org: { select: { name: true } } },
    });
    for (const d of rows) {
      out.push({
        kind: "donor",
        id: d.id,
        passwordHash: d.passwordHash,
        claims: {
          sub: d.id,
          kind: "donor",
          role: "donor",
          orgId: d.orgId,
          name: `${d.firstName} ${d.lastName}`,
          email: d.email,
          v: d.tokenVersion,
        },
        account: { failedLoginCount: d.failedLoginCount, lockedUntil: d.lockedUntil },
        mustChangePassword: d.mustChangePassword,
        needsTwoFactor: false,
        orgName: d.org.name,
      });
    }
  }

  return out.slice(0, MAX_CANDIDATES);
}

/** Candidates that can actually be authenticated (a password exists). */
export function withPassword(candidates: Candidate[]) {
  return candidates.filter(
    (c): c is Candidate & { passwordHash: string } => typeof c.passwordHash === "string"
  );
}
