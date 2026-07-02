import Link from "next/link";
import { Repeat, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { PlanControls } from "@/components/portal/plan-controls";
import { requireDonor } from "@/lib/auth/guards";
import { listDonorPlans } from "@/lib/queries/donor";
import { getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Recurring giving" };

const statusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  suspended: "destructive",
};

export default async function DonorRecurringPage() {
  const session = await requireDonor();
  const [plans, org] = await Promise.all([
    listDonorPlans(session.orgId, session.sub),
    getOrg(session.orgId),
  ]);

  const needsAttention = plans.filter((p) => p.pastDue || p.status === "suspended");

  return (
    <>
      <Topbar title="Recurring giving" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
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
              <Link
                href="/portal/payment-methods"
                className="mt-1 inline-block font-medium text-brand-600 hover:underline"
              >
                Update payment method →
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
                          <PlanControls planId={p.id} status={p.status} retryable={retryable} />
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
