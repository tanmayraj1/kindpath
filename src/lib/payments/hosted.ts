import { getPaymentProviderForOrg, supportsHostedSale } from "@/lib/payments";
import { captureError } from "@/lib/observability";

/**
 * Does this org's OWN gateway use the hosted (redirect) flow?
 *
 * Public payment pages must ask this, not `supportsHostedSale(getPaymentProvider())`.
 * The platform default and the org's configured gateway can differ, and when they
 * did, the page offered an in-app card step while `authorizeCharge` sent the mock
 * placeholder token to a real gateway.
 *
 * Never throws: a credentials problem must not take a charity's donation page
 * offline. It falls back to the non-hosted step, which fails with a message the
 * donor can act on rather than a crash.
 */
export async function orgUsesHostedFlow(orgId: string): Promise<boolean> {
  try {
    return supportsHostedSale(await getPaymentProviderForOrg(orgId));
  } catch (e) {
    captureError(e, { source: "payments.orgUsesHostedFlow", orgId });
    return false;
  }
}
