import { getPaymentProviderForOrg, supportsHostedSale, GatewayNotConnectedError } from "@/lib/payments";
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

/**
 * Can this org take a payment at all right now?
 *
 * Public giving pages ask this before rendering a donation form, so a charity
 * that hasn't connected its merchant yet shows "online giving opens soon" rather
 * than a form that fails at the card step. "unavailable" (credentials present
 * but unreadable) is kept distinct: that is a fault someone must fix, not a
 * setup step.
 */
export async function orgPaymentReadiness(
  orgId: string
): Promise<{ status: "ready"; hosted: boolean } | { status: "not_connected" } | { status: "unavailable" }> {
  try {
    const provider = await getPaymentProviderForOrg(orgId);
    return { status: "ready", hosted: supportsHostedSale(provider) };
  } catch (e) {
    if (e instanceof GatewayNotConnectedError) return { status: "not_connected" };
    captureError(e, { source: "payments.orgPaymentReadiness", orgId });
    return { status: "unavailable" };
  }
}
