import { describe, it, expect } from "vitest";
import { taxFor, provinceCode, computeInvoice, roundCents } from "./tax";

describe("provinceCode", () => {
  it("accepts codes and full names, any case or padding", () => {
    expect(provinceCode("ON")).toBe("ON");
    expect(provinceCode(" on ")).toBe("ON");
    expect(provinceCode("Ontario")).toBe("ON");
    expect(provinceCode("british columbia")).toBe("BC");
  });

  it("returns null for blank or unrecognized input", () => {
    expect(provinceCode(null)).toBeNull();
    expect(provinceCode("")).toBeNull();
    expect(provinceCode("   ")).toBeNull();
    expect(provinceCode("California")).toBeNull();
  });
});

describe("taxFor", () => {
  it("applies HST in HST provinces", () => {
    expect(taxFor("ON")).toMatchObject({ rate: 0.13, label: "HST (13%)" });
    expect(taxFor("Nova Scotia")).toMatchObject({ rate: 0.14 });
    expect(taxFor("NB").rate).toBe(0.15);
  });

  it("applies 5% GST elsewhere", () => {
    expect(taxFor("AB")).toMatchObject({ rate: 0.05, label: "GST (5%)" });
    expect(taxFor("BC").rate).toBe(0.05);
  });

  it("flags provinces with a separate provincial tax we don't collect", () => {
    // Not collecting it is a deliberate choice; silently pretending it doesn't
    // exist would understate what the customer owes.
    for (const p of ["BC", "SK", "MB", "QC"]) {
      expect(taxFor(p).provincialTaxNotCollected).toBe(true);
    }
    expect(taxFor("AB").provincialTaxNotCollected).toBe(false);
    expect(taxFor("ON").provincialTaxNotCollected).toBe(false);
  });

  it("defaults to GST when the province is unknown", () => {
    expect(taxFor(null).rate).toBe(0.05);
    expect(taxFor("nowhere").rate).toBe(0.05);
  });
});

describe("computeInvoice", () => {
  it("computes an Ontario invoice exactly", () => {
    expect(computeInvoice(59, "ON")).toMatchObject({
      subtotal: 59,
      taxRate: 0.13,
      taxAmount: 7.67,
      total: 66.67,
    });
  });

  it("computes an Alberta invoice at 5%", () => {
    expect(computeInvoice(29, "AB")).toMatchObject({ taxAmount: 1.45, total: 30.45 });
  });

  it("rounds half away from zero, not to even", () => {
    // 0.005 must become 0.01. Banker's rounding would give 0.00 and the invoice
    // total would not equal subtotal + tax.
    expect(roundCents(0.005)).toBe(0.01);
    expect(roundCents(2.675)).toBe(2.68);
  });

  it("always keeps total === subtotal + taxAmount after rounding", () => {
    for (const amount of [29, 59, 199, 290, 590, 1990, 33.33, 0.01]) {
      for (const prov of ["ON", "AB", "NS", "QC", null]) {
        const inv = computeInvoice(amount, prov);
        expect(inv.total).toBe(roundCents(inv.subtotal + inv.taxAmount));
      }
    }
  });

  it("handles a zero-value invoice without producing NaN", () => {
    expect(computeInvoice(0, "ON")).toMatchObject({ subtotal: 0, taxAmount: 0, total: 0 });
  });
});
