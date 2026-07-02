/**
 * Feature entitlements engine.
 *
 * Effective features = plan baseline  ⊕  per-org overrides.
 *   - Plan baseline: what a plan tier includes by default.
 *   - Override: super-admin can grant (true) or revoke (false) any feature per org,
 *     stored in Organization.featureOverrides as { [key]: boolean }.
 *
 * The org app reads getEffectiveFeatures() to gate navigation + page access, so
 * toggling a feature in God Mode immediately changes what an institution can use.
 */

export type FeatureKey =
  | "qr"
  | "recurring"
  | "funds"
  | "campaigns"
  | "memberships"
  | "events"
  | "volunteers"
  | "receipts"
  | "annual_receipts"
  | "reports"
  | "communications"
  | "assistant"
  | "sms"
  | "api";

export const FEATURES: { key: FeatureKey; label: string; description: string }[] = [
  { key: "qr", label: "QR & kiosk giving", description: "Branded QR codes and kiosk donation mode." },
  { key: "recurring", label: "Recurring giving", description: "Weekly/monthly/quarterly recurring plans." },
  { key: "funds", label: "Fund designations", description: "Direct gifts to funds (Zakat, Building, etc.)." },
  { key: "campaigns", label: "Fundraising campaigns", description: "Goal-based campaigns with progress bars." },
  { key: "memberships", label: "Memberships & dues", description: "Recurring membership tiers with self-serve join." },
  { key: "events", label: "Event ticketing", description: "Paid events with CRA split-receipting." },
  { key: "volunteers", label: "Volunteer management", description: "Volunteer roster, passes and volunteer portal." },
  { key: "receipts", label: "Tax receipts", description: "Automated CRA receipts / payment confirmations." },
  { key: "annual_receipts", label: "Annual consolidated receipts", description: "Year-end consolidated receipts." },
  { key: "reports", label: "Advanced reporting", description: "Retention, fund-wise and donor analytics." },
  { key: "communications", label: "Donor communications", description: "Segmented, CASL-compliant campaigns." },
  { key: "assistant", label: "AI assistant", description: "In-dashboard assistant for search & insights." },
  { key: "sms", label: "SMS notifications", description: "Text alerts and confirmations." },
  { key: "api", label: "API access", description: "Programmatic access & integrations." },
];

export const ALL_FEATURE_KEYS = FEATURES.map((f) => f.key);

// Plan baselines.
const PLAN_FEATURES: Record<string, FeatureKey[]> = {
  starter: ["qr", "recurring", "receipts"],
  community: [
    "qr",
    "recurring",
    "funds",
    "campaigns",
    "memberships",
    "events",
    "volunteers",
    "receipts",
    "annual_receipts",
    "reports",
    "communications",
    "assistant",
    "sms",
  ],
  enterprise: ALL_FEATURE_KEYS,
};

export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

export function planBaseline(plan: string | null | undefined): Set<FeatureKey> {
  return new Set(PLAN_FEATURES[plan ?? "starter"] ?? PLAN_FEATURES.starter);
}

/** Resolve the effective on/off state for every feature. */
export function getEffectiveFeatures(
  plan: string | null | undefined,
  overrides: unknown
): Record<FeatureKey, boolean> {
  const base = planBaseline(plan);
  const ov = (overrides ?? {}) as FeatureOverrides;
  const out = {} as Record<FeatureKey, boolean>;
  for (const key of ALL_FEATURE_KEYS) {
    out[key] = key in ov ? Boolean(ov[key]) : base.has(key);
  }
  return out;
}

export function hasFeature(
  plan: string | null | undefined,
  overrides: unknown,
  key: FeatureKey
): boolean {
  return getEffectiveFeatures(plan, overrides)[key];
}

/** Describe a feature's source: included by plan, granted, revoked, or default-off. */
export function featureSource(
  plan: string | null | undefined,
  overrides: unknown,
  key: FeatureKey
): "plan" | "granted" | "revoked" | "off" {
  const base = planBaseline(plan).has(key);
  const ov = (overrides ?? {}) as FeatureOverrides;
  if (key in ov) {
    const v = Boolean(ov[key]);
    if (v && !base) return "granted";
    if (!v && base) return "revoked";
    return v ? "plan" : "off";
  }
  return base ? "plan" : "off";
}
