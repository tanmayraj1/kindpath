import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names while resolving Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convert a #rrggbb hex color to an "H S% L%" triplet for use in our HSL CSS
 * variables (e.g. setting --primary to an org's brand color). Returns null if
 * the input isn't a valid 6-digit hex.
 */
export function hexToHslTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** Estimated payment processing fee (2.9% + $0.30) so donors can cover it. */
export function estimateFee(amount: number): number {
  if (amount <= 0) return 0;
  return Math.round((amount * 0.029 + 0.3) * 100) / 100;
}

/** Format a number as CAD currency. */
export function formatCAD(amount: number, opts: Intl.NumberFormatOptions = {}) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    ...opts,
  }).format(amount);
}
