import Link from "next/link";
import { Repeat } from "lucide-react";
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
import { cn, formatCAD } from "@/lib/utils";

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

  return (
    <>
      <Topbar title="Recurring giving" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
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
                  {plans.map((p) => (
                    <Tr key={p.id}>
                      <Td className="font-medium">{p.fund}</Td>
                      <Td className="capitalize text-muted-foreground">{p.frequency}</Td>
                      <Td className="text-muted-foreground">
                        {p.nextBillingDate
                          ? new Date(p.nextBillingDate).toLocaleDateString("en-CA")
                          : "—"}
                      </Td>
                      <Td className="text-right font-medium">
                        {formatCAD(p.amount, { maximumFractionDigits: 0 })}
                      </Td>
                      <Td className="text-right">
                        <Badge variant={statusVariant[p.status] ?? "neutral"} className="capitalize">
                          {p.status}
                        </Badge>
                      </Td>
                      <Td>
                        <PlanControls planId={p.id} status={p.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
