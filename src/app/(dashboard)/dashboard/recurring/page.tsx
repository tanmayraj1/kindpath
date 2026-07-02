import { Repeat } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { OrgPlanControls } from "@/components/dashboard/org-plan-controls";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listRecurringPlans } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Recurring plans" };

const statusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  suspended: "destructive",
};

export default async function RecurringPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "recurring");
  const plans = await listRecurringPlans(session.orgId);

  return (
    <>
      <Topbar title="Recurring plans" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <p className="text-sm text-muted-foreground">
          {plans.length} {plans.length === 1 ? "plan" : "plans"}
        </p>
        <Card>
          <CardContent className="p-6">
            {plans.length === 0 ? (
              <EmptyState
                icon={<Repeat className="size-5" />}
                title="No recurring plans yet"
                body="When donors set up recurring gifts, their plans appear here with billing schedules."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Donor</Th>
                  <Th>Fund</Th>
                  <Th>Frequency</Th>
                  <Th>Next billing</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Manage</Th>
                </Thead>
                <tbody>
                  {plans.map((p) => (
                    <Tr key={p.id}>
                      <Td className="font-medium">{p.donor}</Td>
                      <Td className="text-muted-foreground">{p.fund}</Td>
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
                        <OrgPlanControls planId={p.id} status={p.status} />
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
