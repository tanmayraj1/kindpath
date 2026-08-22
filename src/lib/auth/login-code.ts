import "server-only";
import { randomInt, createHash, timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/db";

/**
 * Single-use, expiring six-digit sign-in codes for donors and volunteers.
 *
 * Deliberately NOT offered to org or platform admins. A code is exactly as strong
 * as the recipient's inbox, and an org admin can void tax receipts, cancel a
 * donor's recurring gift and mass-email every donor on file. Those accounts keep
 * a password plus TOTP; the caller enforces that (see requestLoginCodeAction).
 *
 * This mirrors password-reset.ts — hashed at rest, single use, superseded on
 * reissue — with two deliberate differences:
 *
 *  1. Keyed by EMAIL rather than by principal. A donor may hold accounts at
 *     several organizations under one address; the code proves control of that
 *     inbox, so one code legitimately resolves to all of them and verification
 *     routes through the existing account chooser. Issuing per-account would mail
 *     three codes for one sign-in.
 *  2. An `attemptCount` ceiling on the row. Six digits is a million-wide space, so
 *     the guess budget IS the security property. The Redis limiter in front of it
 *     fails open on error by design, which is fine for a form post and not fine
 *     for a credential — a counter on the row cannot silently become a no-op.
 */

export const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const MAX_ATTEMPTS = 5;
const CODE_DIGITS = 6;

function hashCode(email: string, raw: string): string {
  // The email is bound into the digest, so a hash observed for one address can't
  // be replayed against another row even if the same six digits come up twice.
  return createHash("sha256").update(`${email}:${raw}`).digest("hex");
}

function digestsEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Six digits, uniformly distributed, zero-padded.
 *
 * randomInt is rejection-sampled by Node, so this carries no modulo bias — which
 * `randomBytes(4).readUInt32BE() % 1e6` would, skewing the low end of the range
 * and handing an attacker a better-than-uniform first guess.
 */
export function generateCode(): string {
  return String(randomInt(0, 10 ** CODE_DIGITS)).padStart(CODE_DIGITS, "0");
}

export type IssuedCode = { code: string; expiresAt: Date };

/**
 * Issue a code for an address, invalidating any outstanding one.
 *
 * Superseding matters here beyond tidiness: without it, a user who taps "resend"
 * three times leaves three live codes, tripling the guess surface for the same
 * one sign-in.
 */
export async function issueLoginCode(email: string): Promise<IssuedCode> {
  const key = normalizeEmail(email);
  const code = generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MS);

  await adminDb.loginCode.updateMany({
    where: { email: key, usedAt: null },
    data: { usedAt: new Date() },
  });

  await adminDb.loginCode.create({
    data: { email: key, codeHash: hashCode(key, code), expiresAt },
  });

  return { code, expiresAt };
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "expired" | "too_many_attempts" };

/**
 * Verify a submitted code and burn it.
 *
 * Every failure path returns "invalid" rather than distinguishing "no code was
 * requested" from "wrong digits" — the two are indistinguishable to an attacker
 * probing an address, and telling them apart would leak whether the address is
 * on file. `too_many_attempts` and `expired` are only reachable once a code
 * genuinely exists for that address, so neither discloses anything.
 */
export async function consumeLoginCode(email: string, submitted: string): Promise<ConsumeResult> {
  const key = normalizeEmail(email);
  const clean = submitted.replace(/\D/g, "");

  const record = await adminDb.loginCode.findFirst({
    where: { email: key, usedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, reason: "invalid" };

  if (record.attemptCount >= MAX_ATTEMPTS) {
    // Burn it. Leaving an exhausted code alive lets a "resend" race re-open the
    // same row for more guesses.
    await adminDb.loginCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "too_many_attempts" };
  }

  if (record.expiresAt.getTime() < Date.now()) {
    await adminDb.loginCode.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    return { ok: false, reason: "expired" };
  }

  if (clean.length !== CODE_DIGITS || !digestsEqual(record.codeHash, hashCode(key, clean))) {
    // Count the attempt BEFORE returning, so a client that abandons the response
    // still pays for the guess.
    const bumped = await adminDb.loginCode.update({
      where: { id: record.id },
      data: { attemptCount: { increment: 1 } },
      select: { attemptCount: true },
    });
    if (bumped.attemptCount >= MAX_ATTEMPTS) {
      await adminDb.loginCode.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });
      return { ok: false, reason: "too_many_attempts" };
    }
    return { ok: false, reason: "invalid" };
  }

  await adminDb.loginCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return { ok: true };
}

/** Housekeeping for the cron: drop rows that can no longer be used. */
export async function purgeExpiredLoginCodes(olderThanMs = 24 * 60 * 60 * 1000): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs);
  const { count } = await adminDb.loginCode.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return count;
}
