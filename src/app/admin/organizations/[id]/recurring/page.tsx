import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch, Pagination } from "@/components/ui/list-controls";
import { listRecurringPlans } from "@/lib/queries/org";
import { parsePageParams } from "@/lib/pagination";
import { formatCAD } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  suspended: "destructive",
};

export default async function OrgRecurring({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { page?: string; q?: string; size?: string };
}) {
  // This passed no page argument at all, so support opening a large org's
  // recurring tab meant loading every plan it has ever had, with joins.
  const pageParams = parsePageParams(searchParams);
  const plans = await listRecurringPlans(params.id, pageParams);
  const basePath = `/admin/organizations/${params.id}/recurring`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <ListSearch action={basePath} q={pageParams.q} placeholder="Donor name or email…" label="Search plans" />
        {plans.rows.length === 0 ? (
          <EmptyState
            title={pageParams.q ? "No plans match that search" : "No recurring plans"}
            body={
              pageParams.q
                ? "Try a different donor name or email address."
                : "Recurring gifts for this organization will appear here."
            }
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
            </Thead>
            <tbody>
              {plans.rows.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium">{p.donor}</Td>
                  <Td className="text-muted-foreground">{p.fund}</Td>
                  <Td className="capitalize text-muted-foreground">{p.frequency}</Td>
                  <Td className="text-muted-foreground">
                    {p.nextBillingDate ? new Date(p.nextBillingDate).toLocaleDateString("en-CA") : "—"}
                  </Td>
                  <Td className="text-right font-medium">
                    {formatCAD(p.amount, { maximumFractionDigits: 0 })}
                  </Td>
                  <Td className="text-right">
                    <Badge variant={statusVariant[p.status] ?? "neutral"} className="capitalize">
                      {p.status}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination basePath={basePath} data={plans} noun="plans" />
      </CardContent>
    </Card>
  );
}
