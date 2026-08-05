import { describe, it, expect } from "vitest";
import { parseCredentials } from "./org-credentials";

const BASE = {
  provider: "wevend",
  mid: "KPTEST0001",
  termId: "00000003",
  password: "password123",
};

describe("parseCredentials", () => {
  it("accepts merchant mode (email)", () => {
    const creds = parseCredentials(JSON.stringify({ ...BASE, email: "merchant@org.ca" }));
    expect(creds).toMatchObject({ mid: "KPTEST0001", email: "merchant@org.ca" });
  });

  it("accepts org/ISV mode (wvNumber)", () => {
    const creds = parseCredentials(JSON.stringify({ ...BASE, wvNumber: "WV-ISV-50001" }));
    expect(creds).toMatchObject({ mid: "KPTEST0001", wvNumber: "WV-ISV-50001" });
  });

  it("rejects credentials with no identifiable auth mode", () => {
    // Neither email nor wvNumber: we'd have no way to authenticate, and silently
    // accepting this is how a charge ends up on the wrong merchant.
    expect(parseCredentials(JSON.stringify(BASE))).toBeNull();
  });

  it("rejects missing mid, password, or termId", () => {
    for (const key of ["mid", "password", "termId"] as const) {
      const partial: Record<string, unknown> = { ...BASE, email: "m@org.ca" };
      delete partial[key];
      expect(parseCredentials(JSON.stringify(partial))).toBeNull();
    }
  });

  it("rejects another provider's credentials", () => {
    expect(
      parseCredentials(JSON.stringify({ ...BASE, provider: "stripe", email: "m@org.ca" }))
    ).toBeNull();
  });

  it("rejects malformed JSON without throwing", () => {
    expect(parseCredentials("not json")).toBeNull();
    expect(parseCredentials("")).toBeNull();
  });
});
