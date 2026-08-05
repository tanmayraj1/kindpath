/**
 * Canadian sales tax on KindPath's OWN subscription invoices.
 *
 * This is unrelated to donation receipting — a gift to a registered charity is
 * not a taxable supply. What IS taxable is the SaaS we sell to the charity, and
 * the rate is determined by the customer's province (place of supply for a
 * service supplied remotely), not ours.
 *
 * Rates as of 2026. HST provinces charge a single combined rate; the rest charge
 * 5% GST, with PST/QST administered separately and NOT collected here — an org
 * in BC, SK, MB or QC may owe provincial tax that KindPath doesn't invoice until
 * it's registered in those provinces. Flagged rather than silently ignored.
 */

export type TaxLine = {
  /** Combined rate applied, e.g. 0.13 for Ontario HST. */
  rate: number;
  /** Human label for the invoice line, e.g. "HST (13%)". */
  label: string;
  /** True when a separate provincial tax exists that KindPath does not collect. */
  provincialTaxNotCollected: boolean;
};

const HST: Record<string, number> = {
  ON: 0.13,
  NB: 0.15,
  NL: 0.15,
  NS: 0.14, // reduced from 15% to 14% on 1 April 2025
  PE: 0.15,
};

/** Provinces with a separate provincial sales tax KindPath doesn't administer. */
const SEPARATE_PROVINCIAL_TAX = new Set(["BC", "SK", "MB", "QC"]);

const GST_RATE = 0.05;

export const PROVINCES: { code: string; name: string }[] = [
  { code: "AB", name: "Alberta" },
  { code: "BC", name: "British Columbia" },
  { code: "MB", name: "Manitoba" },
  { code: "NB", name: "New Brunswick" },
  { code: "NL", name: "Newfoundland and Labrador" },
  { code: "NS", name: "Nova Scotia" },
  { code: "NT", name: "Northwest Territories" },
  { code: "NU", name: "Nunavut" },
  { code: "ON", name: "Ontario" },
  { code: "PE", name: "Prince Edward Island" },
  { code: "QC", name: "Quebec" },
  { code: "SK", name: "Saskatchewan" },
  { code: "YT", name: "Yukon" },
];

/** Normalize free-text province input ("Ontario", "on", "ON ") to a code. */
export function provinceCode(input?: string | null): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const upper = trimmed.toUpperCase();
  if (PROVINCES.some((p) => p.code === upper)) return upper;
  const byName = PROVINCES.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
  return byName?.code ?? null;
}

export function taxFor(province?: string | null): TaxLine {
  const code = provinceCode(province);
  if (code && HST[code] !== undefined) {
    return {
      rate: HST[code],
      label: `HST (${(HST[code] * 100).toFixed(0)}%)`,
      provincialTaxNotCollected: false,
    };
  }
  return {
    rate: GST_RATE,
    label: `GST (${(GST_RATE * 100).toFixed(0)}%)`,
    provincialTaxNotCollected: !!code && SEPARATE_PROVINCIAL_TAX.has(code),
  };
}

/** Round to cents the way money should be: half away from zero, not banker's. */
export function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export type InvoiceAmounts = {
  subtotal: number;
  taxRate: number;
  taxLabel: string;
  taxAmount: number;
  total: number;
  provincialTaxNotCollected: boolean;
};

export function computeInvoice(subtotal: number, province?: string | null): InvoiceAmounts {
  const tax = taxFor(province);
  const sub = roundCents(subtotal);
  const taxAmount = roundCents(sub * tax.rate);
  return {
    subtotal: sub,
    taxRate: tax.rate,
    taxLabel: tax.label,
    taxAmount,
    total: roundCents(sub + taxAmount),
    provincialTaxNotCollected: tax.provincialTaxNotCollected,
  };
}
