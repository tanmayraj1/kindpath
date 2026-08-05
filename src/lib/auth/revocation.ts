import "server-only";
import { adminDb } from "@/lib/db";
import type { SessionClaims } from "./jwt";

/**
 * Server-side session revocation for stateless JWTs.
 *
 * Sessions are signed for 7 days and carry no server state, so on their own a
 * disabled user, a suspended organization, or a password reset would leave a
 * live session with full access — including donor PII — for up to a week.
 *
 * Every session therefore carries a `v` (token version). This module re-reads the
 * principal's current version and status on each request and rejects any session
 * whose version has moved on. Bumping `tokenVersion` is the kill switch.
 *
 * Node runtime only (Prisma). The edge middleware still does the cheap
 * signature/shape check; this is the authoritative one, run from the guards.
 */

export type RevocationReason = "ok" | "not_found" | "disabled" | "org_suspended" | "stale_token";

export async function checkSession(claims: SessionClaims): Promise<RevocationReason> {
  const version = claims.v ?? 0;

  switch (claims.kind) {
    case "platform": {
      const a = await adminDb.platformAdmin.findUnique({
        where: { id: claims.sub },
        select: { status: true, tokenVersion: true },
      });
      if (!a) return "not_found";
      if (a.status !== "active") return "disabled";
      return a.tokenVersion === version ? "ok" : "stale_token";
    }
    case "org": {
      const u = await adminDb.orgUser.findUnique({
        where: { id: claims.sub },
        select: { status: true, tokenVersion: true, org: { select: { status: true } } },
      });
      if (!u) return "not_found";
      if (u.status !== "active") return "disabled";
      if (u.org.status !== "active") return "org_suspended";
      return u.tokenVersion === version ? "ok" : "stale_token";
    }
    case "volunteer": {
      const v = await adminDb.volunteer.findUnique({
        where: { id: claims.sub },
        select: { status: true, tokenVersion: true, org: { select: { status: true } } },
      });
      if (!v) return "not_found";
      if (v.status !== "active") return "disabled";
      if (v.org.status !== "active") return "org_suspended";
      return v.tokenVersion === version ? "ok" : "stale_token";
    }
    case "donor": {
      const d = await adminDb.donor.findUnique({
        where: { id: claims.sub },
        select: { tokenVersion: true, org: { select: { status: true } } },
      });
      if (!d) return "not_found";
      if (d.org.status !== "active") return "org_suspended";
      return d.tokenVersion === version ? "ok" : "stale_token";
    }
    default:
      return "not_found";
  }
}

/**
 * Invalidate every existing session for a principal. Call after a password
 * change/reset, when disabling a user, and when revoking org access.
 */
export async function revokeSessions(
  kind: SessionClaims["kind"],
  principalId: string
): Promise<void> {
  const bump = { tokenVersion: { increment: 1 } };
  switch (kind) {
    case "platform":
      await adminDb.platformAdmin.update({ where: { id: principalId }, data: bump });
      return;
    case "org":
      await adminDb.orgUser.update({ where: { id: principalId }, data: bump });
      return;
    case "volunteer":
      await adminDb.volunteer.update({ where: { id: principalId }, data: bump });
      return;
    case "donor":
      await adminDb.donor.update({ where: { id: principalId }, data: bump });
      return;
  }
}

/** Kill every session belonging to an organization (suspension, breach response). */
export async function revokeOrgSessions(orgId: string): Promise<void> {
  await Promise.all([
    adminDb.orgUser.updateMany({ where: { orgId }, data: { tokenVersion: { increment: 1 } } }),
    adminDb.volunteer.updateMany({ where: { orgId }, data: { tokenVersion: { increment: 1 } } }),
    adminDb.donor.updateMany({ where: { orgId }, data: { tokenVersion: { increment: 1 } } }),
  ]);
}
