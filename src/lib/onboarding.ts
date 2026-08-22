/**
 * Whether onboarding step 1 has been saved.
 *
 * The address is not cosmetic: every official receipt must carry it
 * (docs/02_COMPLIANCE.md §1.1) and subscription invoices derive GST/HST from
 * `province` (src/lib/subscriptions.ts). An org that finishes onboarding without
 * it issues non-compliant receipts and is mis-taxed — which is exactly what a
 * deep link to `?step=3` used to allow. Shared by the wizard page (redirect) and
 * the finish action (the actual guarantee).
 */
export function profileComplete(org: {
  addressLine1: string | null;
  city: string | null;
  province: string | null;
  postalCode: string | null;
}): boolean {
  return Boolean(org.addressLine1 && org.city && org.province && org.postalCode);
}
