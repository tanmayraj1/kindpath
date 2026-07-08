import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { XCircle } from "lucide-react";
import { adminDb } from "@/lib/db";
import { getPaymentProviderForOrg, supportsHostedSale } from "@/lib/payments";
import { verifyHostedState, HOSTED_STATE_COOKIE } from "@/lib/hosted-state";
import { signChargeToken } from "@/lib/charge-token";
import { Branded } from "@/components/give/branded";
import { HostedDetailsForm } from "@/components/give/hosted-details-form";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Confirming your payment", robots: { index: false } };

/**
 * Return URL for hosted gateways (WeVend iframe). The gateway redirects here
 * with ?transactionId=…&paymentOrderId=…&success=1. We NEVER trust the success
 * flag — the transaction is confirmed server-side before any receipt exists.
 */
export default async function HostedResponsePage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { transactionId?: string; paymentOrderId?: string; success?: string };
}) {
  const org = await adminDb.organization.findUnique({ where: { slug: params.slug } });
  if (!org) notFound();

  const provider = await getPaymentProviderForOrg(org.id);
  if (!supportsHostedSale(provider)) notFound();

  const state = verifyHostedState(cookies().get(HOSTED_STATE_COOKIE)?.value);
  const { transactionId, paymentOrderId } = searchParams;

  const failure = (title: string, body: string) => (
    <Branded color={org.primaryColor}>
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <Logo className="mx-auto" />
          <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <XCircle className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          <Link href={`/give/${params.slug}`} className={buttonVariants({ size: "lg" }) + " mt-6"}>
            Try again
          </Link>
        </div>
      </div>
    </Branded>
  );

  // Session state must exist, be unexpired, and match the order being confirmed.
  if (!state || state.slug !== params.slug || !transactionId || !paymentOrderId) {
    return failure(
      "Payment session expired",
      "We couldn't match this payment to a donation in progress. No receipt was issued — please start again."
    );
  }
  if (state.paymentOrderId !== paymentOrderId) {
    return failure("Payment mismatch", "This payment doesn't match your donation session. Please start again.");
  }

  // Authoritative check with the gateway — the redirect's success flag is ignored.
  const confirmed = await provider.confirmTransaction(transactionId);
  if (!confirmed.success) {
    return failure(
      "Payment not approved",
      confirmed.failureMessage ?? "Your card was not charged successfully. Please try again."
    );
  }
  // Defense in depth: the gateway must have charged the amount we intended.
  if (confirmed.amount != null && Math.abs(confirmed.amount - state.amount) > 0.01) {
    const { captureError } = await import("@/lib/observability");
    captureError(new Error("hosted amount mismatch"), {
      source: "give.response",
      expected: state.amount,
      charged: confirmed.amount,
      transactionId,
    });
    return failure(
      "Payment amount mismatch",
      "The charged amount didn't match your donation. No receipt was issued — please contact the organization."
    );
  }

  // Payment verified → issue the signed charge token the details step trusts.
  const chargeRef = signChargeToken({
    ref: confirmed.providerChargeRef,
    orgId: org.id,
    amount: state.amount,
    currency: state.currency,
  });

  return (
    <Branded color={org.primaryColor}>
      <div className="container flex min-h-dvh items-start justify-center py-10 sm:py-16">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
          <HostedDetailsForm
            slug={params.slug}
            orgName={org.name}
            chargeRef={chargeRef}
            amountLabel={formatCAD(state.amount)}
            amount={state.amount}
            fundId={state.fundId ?? "none"}
            campaignId={state.campaignId ?? "none"}
            frequency={state.frequency}
            card={confirmed.last4 ? `${confirmed.cardBrand ?? "Card"} •••• ${confirmed.last4}` : null}
          />
        </div>
      </div>
    </Branded>
  );
}
