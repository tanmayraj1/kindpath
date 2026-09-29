import { describe, it, expect } from "vitest";
import { normalizeBrandColor, whiteTextContrast } from "./brand-color";

describe("normalizeBrandColor", () => {
  it("accepts the shapes admins actually type", () => {
    expect(normalizeBrandColor("#1f7a6d")).toBe("#1F7A6D");
    expect(normalizeBrandColor("1F7A6D")).toBe("#1F7A6D");
    expect(normalizeBrandColor("  #1f7a6d ")).toBe("#1F7A6D");
  });

  it("rejects anything that isn't a 6-digit hex", () => {
    for (const bad of ["#fff", "red", "#1F7A6DZ", "", "rgb(0,0,0)"]) {
      expect(normalizeBrandColor(bad)).toBeNull();
    }
  });
});

describe("whiteTextContrast", () => {
  it("passes the KindPath teal and fails a pale yellow", () => {
    expect(whiteTextContrast("#1F7A6D")).toBeGreaterThan(4.5);
    expect(whiteTextContrast("#FFF59D")).toBeLessThan(3);
  });
});
