/**
 * Subscription plan catalog — single source of truth for pricing shown in the
 * onboarding wizard, God Mode, and (later) the public pricing page.
 * Prices are CAD; GST/HST applies on top (see docs/02_COMPLIANCE.md).
 */

export type PlanKey = "starter" | "community" | "enterprise";
export type CycleKey = "monthly" | "annual";

export const PLANS: {
  key: PlanKey;
  name: string;
  priceMonthly: number;
  blurb: string;
  highlights: string[];
}[] = [
  {
    key: "starter",
    name: "Starter",
    priceMonthly: 29,
    blurb: "For small congregations getting started with digital giving.",
    highlights: ["Online giving page + QR", "Recurring giving", "CRA-compliant receipts", "Up to 250 donors"],
  },
  {
    key: "community",
    name: "Community",
    priceMonthly: 59,
    blurb: "Everything growing organizations need to engage donors.",
    highlights: [
      "Everything in Starter",
      "Funds, campaigns, pledges",
      "Memberships & event ticketing",
      "Reports, communications & AI assistant",
      "Up to 1,500 donors",
    ],
  },
  {
    key: "enterprise",
    name: "Enterprise",
    priceMonthly: 199,
    blurb: "For multi-site organizations with advanced needs.",
    highlights: ["Everything in Community", "API access", "White-label branding", "Unlimited donors"],
  },
];

/** Annual billing gives two months free (10× monthly, charged once a year). */
export function planPrice(plan: PlanKey, cycle: CycleKey): number {
  const monthly = PLANS.find((p) => p.key === plan)?.priceMonthly ?? 29;
  return cycle === "annual" ? monthly * 10 : monthly;
}

export function isPlanKey(v: unknown): v is PlanKey {
  return v === "starter" || v === "community" || v === "enterprise";
}
