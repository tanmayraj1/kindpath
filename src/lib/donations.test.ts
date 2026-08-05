import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { isDuplicateChargeError } from "./donations";

/** Build a Prisma known-request error the way the client actually reports P2002. */
function uniqueViolation(target: string | string[]) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "6.19.3",
    meta: { target },
  });
}

describe("isDuplicateChargeError", () => {
  it("recognizes a conflict on the charge_key index", () => {
    expect(isDuplicateChargeError(uniqueViolation("donations_charge_key_key"))).toBe(true);
    expect(isDuplicateChargeError(uniqueViolation(["charge_key"]))).toBe(true);
    expect(isDuplicateChargeError(uniqueViolation(["chargeKey"]))).toBe(true);
  });

  it("does NOT claim unrelated unique conflicts", () => {
    // Critical: a duplicate donor email must not be mistaken for a replayed
    // charge, or the donor would be handed somebody else's receipt.
    expect(isDuplicateChargeError(uniqueViolation("donors_org_id_email_key"))).toBe(false);
    expect(isDuplicateChargeError(uniqueViolation(["orgId", "serialNumber"]))).toBe(false);
  });

  it("ignores non-P2002 Prisma errors and plain errors", () => {
    const notFound = new Prisma.PrismaClientKnownRequestError("not found", {
      code: "P2025",
      clientVersion: "6.19.3",
      meta: { target: "charge_key" },
    });
    expect(isDuplicateChargeError(notFound)).toBe(false);
    expect(isDuplicateChargeError(new Error("charge_key"))).toBe(false);
    expect(isDuplicateChargeError(null)).toBe(false);
    expect(isDuplicateChargeError("charge_key")).toBe(false);
  });

  it("survives a missing or oddly-shaped meta.target", () => {
    const noMeta = new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
      code: "P2002",
      clientVersion: "6.19.3",
    });
    expect(isDuplicateChargeError(noMeta)).toBe(false);
  });
});
