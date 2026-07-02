import { FileCheck2, Download } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDonor } from "@/lib/auth/guards";
import { listDonorReceipts } from "@/lib/queries/donor";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Tax receipts" };

const typeLabel: Record<string, string> = {
  official: "Official receipt",
  confirmation: "Confirmation",
  annual: "Annual receipt",
};

export default async function DonorReceiptsPage() {
  const session = await requireDonor();
  const receipts = await listDonorReceipts(session.orgId, session.sub);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <Topbar title="Tax receipts" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Annual consolidated receipt</CardTitle>
            <p className="text-sm text-muted-foreground">
              A single receipt summarizing all your eligible gifts for {currentYear}, for easy tax filing.
            </p>
          </CardHeader>
          <CardContent>
            <Badge variant="outline">Available at year-end</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All receipts</CardTitle>
          </CardHeader>
          <CardContent>
            {receipts.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 className="size-5" />}
                title="No receipts yet"
                body="Your tax receipts will appear here automatically after you give."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Serial #</Th>
                  <Th>Type</Th>
                  <Th>Issued</Th>
                  <Th className="text-right">Eligible amount</Th>
                  <Th className="text-right">Download</Th>
                </Thead>
                <tbody>
                  {receipts.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-mono text-xs font-medium">{r.serialNumber}</Td>
                      <Td className="text-muted-foreground">{typeLabel[r.type] ?? r.type}</Td>
                      <Td className="text-muted-foreground">
                        {new Date(r.date).toLocaleDateString("en-CA")}
                      </Td>
                      <Td className="text-right font-medium">
                        {formatCAD(r.eligible, { maximumFractionDigits: 0 })}
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
      </main>
    </>
  );
}
