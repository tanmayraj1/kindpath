import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { listDonors } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export default async function OrgDonors({ params }: { params: { id: string } }) {
  const donors = await listDonors(params.id);
  return (
    <Card>
      <CardContent className="p-6">
        {donors.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No donors yet.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Donor</Th>
              <Th>Email</Th>
              <Th>Giving</Th>
              <Th className="text-right">Total given</Th>
              <Th className="text-right">Receipt info</Th>
            </Thead>
            <tbody>
              {donors.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-muted-foreground">{d.email}</Td>
                  <Td>
                    <Badge variant={d.recurring ? "brand" : "neutral"}>
                      {d.recurring ? "Recurring" : "One-time"}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium">
                    {formatCAD(d.totalGiven, { maximumFractionDigits: 0 })}
                  </Td>
                  <Td className="text-right">
                    <Badge variant={d.addressComplete ? "success" : "warning"}>
                      {d.addressComplete ? "Complete" : "Pending"}
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
