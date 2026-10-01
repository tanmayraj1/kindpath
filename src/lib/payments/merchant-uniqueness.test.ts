import { describe, it, expect, vi } from "vitest";

// Sealed blobs are plain JSON here; the real ones are AES-GCM.
vi.mock("@/lib/crypto-box", () => ({ seal: (s: string) => s, open: (s: string) => s }));
vi.mock("@/lib/observability", () => ({ captureError: vi.fn() }));

const orgs = [
  { id: "ram", name: "Mississauga Ram Mandir", posCredentialsRef: JSON.stringify({ provider: "wevend", mid: "1827972", termId: "00000001" }) },
  { id: "stripe-org", name: "Stripe Parish", posCredentialsRef: JSON.stringify({ provider: "stripe", secretKey: "sk_test_abcdefghijkl" }) },
  { id: "broken", name: "Broken Org", posCredentialsRef: "not-json" },
];

vi.mock("@/lib/db", () => ({
  adminDb: {
    organization: {
      findMany: vi.fn(async ({ where }: { where: { NOT: { id: string } } }) =>
        orgs.filter((o) => o.id !== where.NOT.id)
      ),
    },
  },
}));

import { findOrgUsingWeVendMid, sameMerchantId } from "./org-credentials";

describe("one WeVend merchant, one organization", () => {
  it("finds the charity already using a merchant ID", async () => {
    await expect(findOrgUsingWeVendMid("1827972", "attacker")).resolves.toEqual({
      id: "ram",
      name: "Mississauga Ram Mandir",
    });
  });

  it("is not fooled by case or whitespace", async () => {
    await expect(findOrgUsingWeVendMid("  1827972 ", "attacker")).resolves.not.toBeNull();
    expect(sameMerchantId("rctst0001", "RCTST0001")).toBe(true);
  });

  it("lets a charity reconnect its OWN merchant", async () => {
    await expect(findOrgUsingWeVendMid("1827972", "ram")).resolves.toBeNull();
  });

  it("ignores other providers and unreadable credentials rather than crashing", async () => {
    await expect(findOrgUsingWeVendMid("9999999", "attacker")).resolves.toBeNull();
  });
});
