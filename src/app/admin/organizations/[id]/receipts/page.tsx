import { Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch, Pagination } from "@/components/ui/list-controls";
import { listReceipts } from "@/lib/queries/org";
import { parsePageParams } from "@/lib/pagination";
import { formatCAD } from "@/lib/utils";

const typeLabel: Record<string, string> = {
  official: "Official",
  confirmation: "Confirmation",
  annual: "Annual",
};

export default async function OrgReceipts({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { page?: string; q?: string; size?: string };
}) {
  const p = parsePageParams(searchParams);
  const receipts = await listReceipts(params.id, p);
  const basePath = `/admin/organizations/${params.id}/receipts`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <ListSearch action={basePath} q={p.q} placeholder="Serial number or donor…" label="Search receipts" />
        {receipts.rows.length === 0 ? (
          <EmptyState
            icon={<Download className="size-5" />}
            title={p.q ? "No receipts match that search" : "No receipts issued yet"}
            body={
              p.q
                ? "Try a different serial number or donor name."
                : "Receipts appear here once this organization starts issuing them."
            }
          />
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
              {receipts.rows.map((r) => (
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
        <Pagination basePath={basePath} data={receipts} noun="receipts" />
      </CardContent>
    </Card>
  );
}
