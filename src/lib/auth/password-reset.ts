import "server-only";
import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/db";
import { hashPassword } from "./password";
import { revokeSessions } from "./revocation";
import type { SessionClaims } from "./jwt";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/**
 * Single-use, expiring password reset + invitation tokens.
 *
 * Design notes:
 *  - The raw token only ever exists in the email. The database stores SHA-256 of
 *    it, so a database dump (or a leaked backup) cannot be replayed into an
 *    account takeover.
 *  - Issuing a new token invalidates outstanding ones for that principal, so a
 *    forwarded old email can't be used after the user asks for a fresh link.
 *  - Consuming a token bumps `tokenVersion`, which kills every session the
 *    account already had — the point of a reset is to lock an attacker out.
 */

const TOKEN_BYTES = 32;
export const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days — new staff need slack

export type Principal = SessionClaims["kind"];
export type Purpose = "reset" | "invite" | "verify";

/** Email-verification links live as long as an invite — people sign up and read mail later. */
export const VERIFY_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time compare of two hex digests (defence against timing oracles). */
function digestsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type IssuedToken = { token: string; expiresAt: Date };

export async function issueResetToken(args: {
  principal: Principal;
  principalId: string;
  orgId?: string | null;
  purpose?: Purpose;
}): Promise<IssuedToken> {
  const purpose = args.purpose ?? "reset";
  const raw = randomBytes(TOKEN_BYTES).toString("base64url");
  const ttl =
    purpose === "invite" ? INVITE_TTL_MS : purpose === "verify" ? VERIFY_TTL_MS : RESET_TTL_MS;
  const expiresAt = new Date(Date.now() + ttl);

  // Supersede outstanding tokens for this principal AND PURPOSE. Scoping to the
  // purpose matters: a password reset must not silently cancel a pending email
  // verification (or the reverse), which is what an unscoped sweep would do.
  await adminDb.passwordResetToken.updateMany({
    where: { principal: args.principal, principalId: args.principalId, purpose, usedAt: null },
    data: { usedAt: new Date() },
  });

  await adminDb.passwordResetToken.create({
    data: {
      principal: args.principal,
      principalId: args.principalId,
      orgId: args.orgId ?? null,
      tokenHash: hashToken(raw),
      purpose,
      expiresAt,
    },
  });

  return { token: raw, expiresAt };
}

export type ConsumeResult =
  | { ok: true; principal: Principal; principalId: string; orgId: string | null }
  | { ok: false; reason: "invalid" | "expired" | "used" | "revoked" };

/**
 * Is this principal still entitled to set a password?
 *
 * A token is a bearer credential that outlives the state it was issued against.
 * Without this check, a link mailed before an account was erased or disabled
 * still writes a fresh password onto that row — re-arming a record the operator
 * deliberately took out of service, and in the donor case undoing an erasure
 * that the Privacy Act obliged us to perform.
 */
async function stillEligible(principal: Principal, id: string): Promise<boolean> {
  switch (principal) {
    case "platform": {
      const row = await adminDb.platformAdmin.findUnique({ where: { id }, select: { status: true } });
      return row?.status === "active";
    }
    case "org": {
      const row = await adminDb.orgUser.findUnique({ where: { id }, select: { status: true } });
      return row?.status === "active";
    }
    case "volunteer": {
      const row = await adminDb.volunteer.findUnique({ where: { id }, select: { status: true } });
      return row?.status === "active";
    }
    case "donor": {
      const row = await adminDb.donor.findUnique({ where: { id }, select: { anonymizedAt: true } });
      return row != null && row.anonymizedAt == null;
    }
    default:
      return false;
  }
}

/**
 * Verify a raw token and set the new password atomically. Returns the principal
 * on success so the caller can sign the user in or route them to the right portal.
 */
export async function consumeResetToken(raw: string, newPassword: string): Promise<ConsumeResult> {
  if (!raw) return { ok: false, reason: "invalid" };
  const digest = hashToken(raw);

  const record = await adminDb.passwordResetToken.findUnique({ where: { tokenHash: digest } });
  if (!record || !digestsEqual(record.tokenHash, digest)) return { ok: false, reason: "invalid" };

  // Purpose is load-bearing, not a label. This table also holds "verify" tokens,
  // which are emailed on signup, live for seven days, and are meant to prove an
  // address — not to grant the power to set a password. Without this check that
  // verification link is a working credential at /reset.
  if (record.purpose !== "reset" && record.purpose !== "invite") {
    return { ok: false, reason: "invalid" };
  }

  if (record.usedAt) return { ok: false, reason: "used" };
  if (record.expiresAt.getTime() < Date.now()) return { ok: false, reason: "expired" };

  const principal = record.principal as Principal;
  if (!(await stillEligible(principal, record.principalId))) {
    // Spend the token so a revoked account can't keep retrying it.
    await adminDb.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "revoked" };
  }

  const passwordHash = await hashPassword(newPassword);

  // Mark used first: if the password write fails, the token is spent rather than
  // left replayable. The user can always request another link.
  await adminDb.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const cleared = {
    passwordHash,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
  };

  switch (principal) {
    case "platform":
      await adminDb.platformAdmin.update({ where: { id: record.principalId }, data: cleared });
      break;
    case "org":
      await adminDb.orgUser.update({ where: { id: record.principalId }, data: cleared });
      break;
    case "volunteer":
      await adminDb.volunteer.update({ where: { id: record.principalId }, data: cleared });
      break;
    case "donor":
      await adminDb.donor.update({ where: { id: record.principalId }, data: cleared });
      break;
    default:
      return { ok: false, reason: "invalid" };
  }

  // A reset exists to lock somebody out — drop every session the account had.
  await revokeSessions(principal, record.principalId);

  return { ok: true, principal, principalId: record.principalId, orgId: record.orgId };
}

/**
 * Spend every outstanding token for a principal.
 *
 * Called when an account is erased or disabled. Revoking sessions alone is not
 * enough: an unused invite or reset link is a standing invitation to create a
 * NEW session, so it has to be spent at the same moment.
 */
export async function invalidateTokensFor(principal: Principal, principalId: string): Promise<void> {
  await adminDb.passwordResetToken.updateMany({
    where: { principal, principalId, usedAt: null },
    data: { usedAt: new Date() },
  });
}

/** Absolute URL a recipient clicks. Kept here so email + tests agree on the shape. */
export function resetUrl(token: string): string {
  const base = deploymentUrl();
  return `${base}/reset?token=${encodeURIComponent(token)}`;
}
