import "server-only";
import { adminDb } from "@/lib/db";
import type { SessionClaims } from "./jwt";

/**
 * Per-ACCOUNT login lockout.
 *
 * The IP rate limiter alone doesn't stop a password spray from a botnet: each
 * source IP stays under the per-IP budget while one account absorbs thousands of
 * guesses. And the limiter deliberately fails OPEN on a Redis outage, so it can't
 * be the only control on the credential path.
 *
 * Counters live on the account row: MAX_ATTEMPTS consecutive failures lock it for
 * LOCK_MS; any success clears the counter.
 */

export const MAX_ATTEMPTS = 8;
export const LOCK_MS = 15 * 60 * 1000;

type Kind = SessionClaims["kind"];
type AccountState = { failedLoginCount: number; lockedUntil: Date | null };

async function update(kind: Kind, id: string, data: Partial<AccountState>): Promise<void> {
  switch (kind) {
    case "platform":
      await adminDb.platformAdmin.update({ where: { id }, data });
      return;
    case "org":
      await adminDb.orgUser.update({ where: { id }, data });
      return;
    case "volunteer":
      await adminDb.volunteer.update({ where: { id }, data });
      return;
    case "donor":
      await adminDb.donor.update({ where: { id }, data });
      return;
  }
}

/** True when the account is currently locked out. */
export function isLocked(account: AccountState): boolean {
  return !!account.lockedUntil && account.lockedUntil.getTime() > Date.now();
}

/** Minutes remaining on a lock, rounded up — for the user-facing message. */
export function lockMinutesRemaining(account: AccountState): number {
  if (!account.lockedUntil) return 0;
  return Math.max(1, Math.ceil((account.lockedUntil.getTime() - Date.now()) / 60_000));
}

/**
 * The state an account moves to after one more failed attempt. Pure, so the
 * threshold behaviour is testable without a database.
 */
export function nextFailureState(account: AccountState, now = Date.now()): AccountState {
  const failedLoginCount = account.failedLoginCount + 1;
  return {
    failedLoginCount,
    lockedUntil:
      failedLoginCount >= MAX_ATTEMPTS ? new Date(now + LOCK_MS) : account.lockedUntil,
  };
}

/** Record a failed attempt; locks the account once the threshold is crossed. */
export async function registerFailure(kind: Kind, id: string, account: AccountState): Promise<void> {
  await update(kind, id, nextFailureState(account));
}

/** Clear counters after a genuine sign-in. */
export async function registerSuccess(kind: Kind, id: string, account: AccountState): Promise<void> {
  if (account.failedLoginCount === 0 && !account.lockedUntil) return;
  await update(kind, id, { failedLoginCount: 0, lockedUntil: null });
}
