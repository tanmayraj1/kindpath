import { describe, it, expect, vi } from "vitest";
import { __testing } from "./privacy";

/**
 * The scrub payload is the heart of the erasure flow, so it's tested directly.
 *
 * Two obligations pull in opposite directions here: a donor may demand erasure,
 * and the charity MUST retain the records behind every receipt it issued. Getting
 * this wrong in either direction is a legal problem, not a bug.
 */

// The module reaches for Prisma at import time; stub the DB layer so the pure
// parts can be exercised without a database.
vi.mock("@/lib/db", () => ({ adminDb: {}, db: {} }));
vi.mock("@/lib/tenant", () => ({ withTenant: vi.fn() }));
vi.mock("@/lib/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/auth/revocation", () => ({ revokeSessions: vi.fn() }));


describe("erasure scrub payload", () => {
  const scrub = __testing.redacted("donor-123");

  it("clears every direct identifier", () => {
    for (const field of [
      "phone",
      "addressLine1",
      "addressLine2",
      "city",
      "province",
      "postalCode",
      "notes",
    ] as const) {
      expect(scrub[field], `${field} must be cleared`).toBeNull();
    }
    expect(scrub.middleInitial).toBeNull();
  });

  it("keeps the email unique per donor so the org-scoped unique index still holds", () => {
    // Blanking every erased donor's email to the same value would collide on the
    // second erasure in an organization and fail the request outright.
    const a = __testing.redacted("donor-a").email;
    const b = __testing.redacted("donor-b").email;
    expect(a).not.toBe(b);
    expect(a).toContain("donor-a");
    // .invalid is reserved by RFC 2606 — it can never be routed to a real inbox.
    expect(a.endsWith("@redacted.invalid")).toBe(true);
  });

  it("revokes every contactable state, not just the identifiers", () => {
    // Erasing the address but leaving marketing opt-in set would keep the record
    // inside campaign segments — a CASL problem on top of a privacy one.
    expect(scrub.emailMarketingOptIn).toBe(false);
    expect(scrub.smsMarketingOptIn).toBe(false);
    expect(scrub.caslConsent).toBe("none");
    expect(scrub.caslConsentSource).toBe("erasure_request");
  });

  it("disables sign-in, because the row is no longer a person's account", () => {
    expect(scrub.passwordHash).toBeNull();
    expect(scrub.googleId).toBeNull();
  });

  it("does NOT touch anything a receipt depends on", () => {
    // Receipts carry their own donorNameSnapshot / donorAddressSnapshot, and the
    // donation rows hold the amounts. The scrub must not reach any of them.
    const keys = Object.keys(scrub);
    for (const forbidden of [
      "donorNameSnapshot",
      "donorAddressSnapshot",
      "amount",
      "eligibleAmount",
      "serialNumber",
      "orgId",
      "id",
    ]) {
      expect(keys, `scrub must not write ${forbidden}`).not.toContain(forbidden);
    }
  });

  it("leaves the record in a valid state (name placeholders, not empty strings)", () => {
    // firstName/lastName are non-nullable in the schema; empty strings would
    // render as a blank row in the org's donor list rather than an explanation.
    expect(scrub.firstName).toBeTruthy();
    expect(scrub.lastName).toBeTruthy();
    expect(`${scrub.firstName} ${scrub.lastName}`.toLowerCase()).toContain("removed");
  });

  it("marks the address incomplete so no new receipt can be issued to it", () => {
    expect(scrub.addressStatus).toBe("pending");
  });
});
