import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { listRecurringPlans } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

const statusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  suspended: "destructive",
};

export default async function OrgRecurring({ params }: { params: { id: string } }) {
  const plans = await listRecurringPlans(params.id);
  return (
    <Card>
      <CardContent className="p-6">
        {plans.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recurring plans.</p>
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
              {plans.map((p) => (
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
      </CardContent>
    </Card>
  );
}
