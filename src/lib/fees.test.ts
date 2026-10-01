import { describe, it, expect } from "vitest";
import { estimateFee, withProcessingFee, formatCAD } from "./utils";

describe("fee estimation (cover-the-fees)", () => {
  it("computes a flat 2.4%", () => {
    expect(estimateFee(100)).toBe(2.4);
    expect(estimateFee(50)).toBe(1.2);
    expect(estimateFee(1)).toBe(0.02); // not 33 cents — there is no fixed fee
    expect(estimateFee(1250)).toBe(30);
  });
  it("always adds the fee to the charged total", () => {
    expect(withProcessingFee(100)).toBe(102.4);
    expect(withProcessingFee(1)).toBe(1.02);
    expect(withProcessingFee(0)).toBe(0);
  });
  it("is zero for non-positive amounts", () => {
    expect(estimateFee(0)).toBe(0);
    expect(estimateFee(-10)).toBe(0);
  });
});

describe("currency formatting", () => {
  it("formats CAD", () => {
    expect(formatCAD(50)).toContain("50");
    expect(formatCAD(1234.5)).toContain("1,234");
  });
});
