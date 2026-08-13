import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { listFunds } from "@/lib/queries/org";

export default async function OrgFunds({ params }: { params: { id: string } }) {
  const funds = await listFunds(params.id);
  return (
    <Card>
      <CardContent className="p-6">
        {funds.length === 0 ? (
          <EmptyState title="No funds defined" body="This organization hasn't set up any funds for donors to designate gifts to." />
        ) : (
          <Table>
            <Thead>
              <Th>Fund</Th>
              <Th>Code</Th>
              <Th className="text-right">Donations</Th>
              <Th className="text-right">Status</Th>
            </Thead>
            <tbody>
              {funds.map((f) => (
                <Tr key={f.id}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td className="text-muted-foreground">{f.code ?? "—"}</Td>
                  <Td className="text-right text-muted-foreground">{f.donationCount}</Td>
                  <Td className="text-right">
                    <Badge variant={f.isActive ? "success" : "neutral"}>
                      {f.isActive ? "Active" : "Inactive"}
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
