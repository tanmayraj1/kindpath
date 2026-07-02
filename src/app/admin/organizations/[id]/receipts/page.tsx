import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { listReceipts } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  official: "Official",
  confirmation: "Confirmation",
  annual: "Annual",
};

export default async function OrgReceipts({ params }: { params: { id: string } }) {
  const receipts = await listReceipts(params.id);
  return (
    <Card>
      <CardContent className="p-6">
        {receipts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No receipts issued yet.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Serial #</Th>
              <Th>Donor</Th>
              <Th>Type</Th>
              <Th className="text-right">Eligible</Th>
              <Th className="text-right">Status</Th>
              <Th className="text-right">PDF</Th>
            </Thead>
            <tbody>
              {receipts.map((r) => (
                <Tr key={r.id}>
                  <Td className="font-mono text-xs font-medium">{r.serialNumber}</Td>
                  <Td className="font-medium">{r.donor}</Td>
                  <Td className="text-muted-foreground">{typeLabel[r.type] ?? r.type}</Td>
                  <Td className="text-right font-medium">
                    {formatCAD(r.eligibleAmount, { maximumFractionDigits: 0 })}
                  </Td>
                  <Td className="text-right">
                    <Badge variant={r.status === "issued" ? "success" : "neutral"} className="capitalize">
                      {r.status}
                    </Badge>
                  </Td>
                  <Td className="text-right">
                    <a
                      href={`/api/receipts/${r.id}/pdf`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                    >
                      <Download className="size-4" /> PDF
                    </a>
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
