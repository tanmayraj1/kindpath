import { describe, it, expect } from "vitest";
import { orderBinding } from "./order-binding";

describe("orderBinding", () => {
  it("accepts the transaction for the order we opened", () => {
    expect(orderBinding("wevend", "po_A", "po_A")).toBe("ok");
  });

  it("REFUSES a transaction from a different order — another charity's sale, or someone else's", () => {
    expect(orderBinding("wevend", "po_B", "po_A")).toBe("mismatch");
    expect(orderBinding("stripe", "cs_B", "cs_A")).toBe("mismatch");
  });

  it("flags a WeVend confirmation with no order id instead of passing it silently", () => {
    expect(orderBinding("wevend", undefined, "po_A")).toBe("unverified");
  });

  it("leaves the simulated gateway, which returns no order id, unaffected", () => {
    expect(orderBinding("mock", undefined, "mpo_1")).toBe("ok");
  });
});
