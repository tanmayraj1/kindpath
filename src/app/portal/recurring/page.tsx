import Link from "next/link";
import { Repeat, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PlanControls } from "@/components/portal/plan-controls";
import { UpdateCardButton } from "@/components/portal/update-card-button";
import { FormAlert } from "@/components/ui/form-alert";
import { requireDonor } from "@/lib/auth/guards";
import { listDonorPlans } from "@/lib/queries/donor";
import { getOrg } from "@/lib/queries/org";
import { orgUsesHostedFlow } from "@/lib/payments/hosted";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Recurring giving" };

const statusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  suspended: "destructive",
};

/** Outcome of a card replacement, passed back through the redirect. */
const UPDATE_MESSAGES: Record<string, { variant: "success" | "error" | "info"; text: string }> = {
  ok: {
    variant: "success",
    text: "Thank you — your gift went through on the new card, your receipt is on its way, and future gifts will use this card.",
  },
  cancelled: { variant: "info", text: "No changes were made and your card was not charged." },
  expired: {
    variant: "error",
    text: "That payment session had expired, so we couldn't match it to your gift. Nothing was charged — please try again.",
  },
  declined: {
    variant: "error",
    text: "Your card was declined and nothing was charged. Please check the details or try a different card.",
  },
  mismatch: {
    variant: "error",
    text: "The amount charged didn't match your gift, so we stopped. Please contact the organization before trying again.",
  },
  unavailable: {
    variant: "error",
    text: "This organization can't take card updates online yet. Please contact them and they can update it for you.",
  },
  charged_not_recorded: {
    variant: "error",
    text: "Your payment went through but we couldn't finish updating your gift. We've been alerted — please contact the organization and quote today's date. Do not pay again.",
  },
};

export default async function DonorRecurringPage({
  searchParams,
}: {
  searchParams?: { update?: string };
}) {
  const session = await requireDonor();
  const [plans, org, hosted] = await Promise.all([
    listDonorPlans(session.orgId, session.sub),
    getOrg(session.orgId),
    orgUsesHostedFlow(session.orgId),
  ]);
  const update = searchParams?.update ? UPDATE_MESSAGES[searchParams.update] : undefined;

  const needsAttention = plans.filter((p) => p.pastDue || p.status === "suspended");

  return (
    <>
      <Topbar title="Recurring giving" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        {update && (
          <FormAlert variant={update.variant === "error" ? "error" : update.variant}>
            {update.text}
          </FormAlert>
        )}

        {needsAttention.length > 0 && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">
                {needsAttention.length === 1
                  ? "A recurring gift needs your attention"
                  : `${needsAttention.length} recurring gifts need your attention`}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                A recent payment didn&apos;t go through. Check your card is up to date, then use{" "}
                <span className="font-medium">Retry payment</span> below. Suspended gifts stop until a
                payment succeeds.
              </p>
              {/* This used to link to the payment-methods page, which could only
                  REMOVE cards — so the one group of donors this banner exists for
                  had nowhere to go. The button on the failing row replaces the
                  card and settles the missed gift in one step. */}
              <p className="mt-1 text-muted-foreground">
                {hosted
                  ? "Use “Pay with a new card” on the gift below to update your card and settle it in one step."
                  : "Please contact the organization and they can update your card for you."}
              </p>
              <Link
                href="/portal/payment-methods"
                className="mt-1 inline-block font-medium text-brand-600 hover:underline"
              >
                See saved cards →
              </Link>
            </div>
          </div>
        )}

        <Card>
          <CardContent className="p-6">
            {plans.length === 0 ? (
              <EmptyState
                icon={<Repeat className="size-5" />}
                title="No recurring gifts"
                body="Set up a recurring gift to support your community every month."
                action={
                  <Link href={`/give/${org?.slug ?? ""}`} className={buttonVariants({ size: "sm" })}>
                    Start giving
                  </Link>
                }
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Fund</Th>
                  <Th>Frequency</Th>
                  <Th>Next gift</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Manage</Th>
                </Thead>
                <tbody>
                  {plans.map((p) => {
                    const retryable = p.pastDue || p.status === "suspended";
                    return (
                      <Tr key={p.id} className={retryable ? "bg-destructive/5" : undefined}>
                        <Td className="font-medium">{p.fund}</Td>
                        <Td className="capitalize text-muted-foreground">{p.frequency}</Td>
                        <Td className="text-muted-foreground">
                          {p.pastDue ? (
                            <span className="text-destructive">Retry pending</span>
                          ) : p.nextBillingDate ? (
                            new Date(p.nextBillingDate).toLocaleDateString("en-CA")
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="text-right font-medium">
                          {formatCAD(p.amount, { maximumFractionDigits: 0 })}
                        </Td>
                        <Td className="text-right">
                          <Badge
                            variant={p.pastDue ? "destructive" : statusVariant[p.status] ?? "neutral"}
                            className="capitalize"
                          >
                            {p.pastDue ? "Payment failed" : p.status}
                          </Badge>
                        </Td>
                        <Td>
                          <div className="flex flex-col items-end gap-2">
                            <PlanControls planId={p.id} status={p.status} retryable={retryable} />
                            {hosted && p.status !== "cancelled" && (
                              <UpdateCardButton
                                planId={p.id}
                                amount={p.amount}
                                variant={retryable ? "primary" : "outline"}
                              />
                            )}
                          </div>
                        </Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
