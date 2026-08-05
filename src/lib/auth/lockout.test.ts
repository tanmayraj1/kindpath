import { describe, it, expect } from "vitest";
import {
  isLocked,
  lockMinutesRemaining,
  nextFailureState,
  MAX_ATTEMPTS,
  LOCK_MS,
} from "./lockout";

const NOW = new Date("2026-08-06T12:00:00Z").getTime();

describe("isLocked", () => {
  it("is false with no lock", () => {
    expect(isLocked({ failedLoginCount: 3, lockedUntil: null })).toBe(false);
  });

  it("is false once the lock has elapsed", () => {
    expect(isLocked({ failedLoginCount: 8, lockedUntil: new Date(Date.now() - 1000) })).toBe(false);
  });

  it("is true while the lock is in the future", () => {
    expect(isLocked({ failedLoginCount: 8, lockedUntil: new Date(Date.now() + 60_000) })).toBe(true);
  });
});

describe("nextFailureState", () => {
  it("counts up without locking below the threshold", () => {
    const next = nextFailureState({ failedLoginCount: 0, lockedUntil: null }, NOW);
    expect(next).toEqual({ failedLoginCount: 1, lockedUntil: null });
  });

  it("locks exactly at the threshold, not before", () => {
    const justBefore = nextFailureState(
      { failedLoginCount: MAX_ATTEMPTS - 2, lockedUntil: null },
      NOW
    );
    expect(justBefore.lockedUntil).toBeNull();

    const atThreshold = nextFailureState(
      { failedLoginCount: MAX_ATTEMPTS - 1, lockedUntil: null },
      NOW
    );
    expect(atThreshold.failedLoginCount).toBe(MAX_ATTEMPTS);
    expect(atThreshold.lockedUntil?.getTime()).toBe(NOW + LOCK_MS);
  });

  it("extends the lock on further attempts while already locked", () => {
    const later = NOW + 60_000;
    const next = nextFailureState(
      { failedLoginCount: MAX_ATTEMPTS, lockedUntil: new Date(NOW + LOCK_MS) },
      later
    );
    expect(next.lockedUntil?.getTime()).toBe(later + LOCK_MS);
  });
});

describe("lockMinutesRemaining", () => {
  it("is 0 when not locked", () => {
    expect(lockMinutesRemaining({ failedLoginCount: 0, lockedUntil: null })).toBe(0);
  });

  it("rounds up so a user is never told '0 minutes' while still locked", () => {
    expect(lockMinutesRemaining({ failedLoginCount: 8, lockedUntil: new Date(Date.now() + 1_000) })).toBe(1);
  });

  it("reports whole minutes for a longer lock", () => {
    expect(
      lockMinutesRemaining({ failedLoginCount: 8, lockedUntil: new Date(Date.now() + 9.5 * 60_000) })
    ).toBe(10);
  });
});
