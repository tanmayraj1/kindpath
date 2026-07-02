import { describe, it, expect } from "vitest";
import { estimateFee, formatCAD } from "./utils";

describe("fee estimation (cover-the-fees)", () => {
  it("computes 2.9% + $0.30", () => {
    expect(estimateFee(100)).toBe(3.2); // 2.90 + 0.30
    expect(estimateFee(50)).toBe(1.75); // 1.45 + 0.30
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
