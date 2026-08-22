import type { PaymentProvider } from "./provider";
import type { PaymentEvent, RawWebhook } from "./types";
import { UnsupportedWebhookEvent } from "./types";

/**
 * Verify an inbound webhook against the platform gateway first, then — if the
 * signature doesn't match — against the gateway of the org the payload refers
 * to.
 *
 * Why this exists: organizations can connect their OWN Stripe account
 * (Organization.posCredentialsRef). Webhooks from that account are signed with
 * that account's signing secret, not the platform's. Until this helper the
 * route only ever tried the platform secret, so a refund issued from a
 * charity's own Stripe dashboard was rejected with 400 and the tax receipt it
 * should have voided stayed valid.
 *
 * The org is read from the UNVERIFIED body and used only to choose which key to
 * try. Nothing is trusted until a signature verifies against that key — a
 * forged body can at most make us try a different real secret and fail.
 */
export type WebhookVerifyDeps = {
  platform: () => PaymentProvider;
  forOrg: (orgId: string) => Promise<PaymentProvider>;
  /** Map a provider charge reference (e.g. a Stripe payment-intent id) to the org that owns it. */
  orgIdForChargeRef: (ref: string) => Promise<string | null>;
};

export function candidateOrgIdFromBody(body: string): { orgId?: string; chargeRef?: string } {
  try {
    const parsed = JSON.parse(body) as {
      data?: { object?: { id?: string; payment_intent?: string; metadata?: Record<string, string> } };
    };
    const obj = parsed.data?.object ?? {};
    return {
      orgId: obj.metadata?.orgId || undefined,
      chargeRef: obj.payment_intent ?? obj.id ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function verifyInboundWebhook(
  raw: RawWebhook,
  deps: WebhookVerifyDeps
): Promise<{ event: PaymentEvent; provider: PaymentProvider }> {
  const platform = deps.platform();
  try {
    return { event: await platform.verifyWebhook(raw), provider: platform };
  } catch (e) {
    // A valid signature for a type we don't act on, or a provider that has no
    // webhooks at all: those are answers, not signature failures. Propagate.
    if (e instanceof UnsupportedWebhookEvent) throw e;
    if (e instanceof Error && /does not send webhooks/i.test(e.message)) throw e;

    const hint = candidateOrgIdFromBody(raw.body);
    const orgId =
      hint.orgId ?? (hint.chargeRef ? await deps.orgIdForChargeRef(hint.chargeRef) : null);
    if (!orgId) throw e;

    // Unreadable org credentials throw here; that is a refusal we want to keep
    // as a signature failure from the sender's point of view.
    const orgProvider = await deps.forOrg(orgId).catch(() => null);
    if (!orgProvider || orgProvider === platform) throw e;

    return { event: await orgProvider.verifyWebhook(raw), provider: orgProvider };
  }
}
