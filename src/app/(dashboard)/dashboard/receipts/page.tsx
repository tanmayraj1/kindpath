import { FileCheck2, Download } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { VoidReceiptButton } from "@/components/dashboard/void-receipt-button";
import { AnnualReceiptsButton } from "@/components/dashboard/annual-receipts-button";
import { requireOrgUser } from "@/lib/auth/guards";
import { listReceipts, getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Receipts" };

const typeLabel: Record<string, string> = {
  official: "Official receipt",
  confirmation: "Confirmation",
  annual: "Annual receipt",
};

const statusVariant: Record<string, "success" | "neutral" | "warning"> = {
  issued: "success",
  voided: "neutral",
  replaced: "warning",
};

export default async function ReceiptsPage() {
  const session = await requireOrgUser();
  const [receipts, org] = await Promise.all([listReceipts(session.orgId), getOrg(session.orgId)]);
  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

  return (
    <>
      <Topbar title="Receipts" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        {org?.charityStatus === "registered" && (
          <Card>
            <CardHeader>
              <CardTitle>Annual consolidated receipts</CardTitle>
              <p className="text-sm text-muted-foreground">
                Generate one year-end CRA receipt per donor, summing their eligible gifts for the
                year. Donors can download it from their portal. Re-running skips donors who already
                have one.
              </p>
            </CardHeader>
            <CardContent>
              <AnnualReceiptsButton years={years} />
            </CardContent>
          </Card>
        )}
        <p className="text-sm text-muted-foreground">
          {receipts.length} {receipts.length === 1 ? "document" : "documents"} issued
        </p>
        <Card>
          <CardContent className="p-6">
            {receipts.length === 0 ? (
              <EmptyState
                icon={<FileCheck2 className="size-5" />}
                title="No receipts yet"
                body="Receipts are generated automatically when donors give and complete their details."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Serial #</Th>
                  <Th>Donor</Th>
                  <Th>Type</Th>
                  <Th>Issued</Th>
                  <Th className="text-right">Eligible amount</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Actions</Th>
                </Thead>
                <tbody>
                  {receipts.map((r) => (
                    <Tr key={r.id}>
                      <Td className="font-mono text-xs font-medium">{r.serialNumber}</Td>
                      <Td className="font-medium">{r.donor}</Td>
                      <Td className="text-muted-foreground">{typeLabel[r.type] ?? r.type}</Td>
                      <Td className="text-muted-foreground">
                        {new Date(r.dateIssued).toLocaleDateString("en-CA")}
                      </Td>
                      <Td className="text-right font-medium">
                        {formatCAD(r.eligibleAmount, { maximumFractionDigits: 0 })}
                      </Td>
                      <Td className="text-right">
                        <Badge variant={statusVariant[r.status] ?? "neutral"} className="capitalize">
                          {r.status}
                        </Badge>
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-3">
                          <a
                            href={`/api/receipts/${r.id}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                          >
                            <Download className="size-4" /> PDF
                          </a>
                          {r.status === "issued" && <VoidReceiptButton receiptId={r.id} />}
                        </div>
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
