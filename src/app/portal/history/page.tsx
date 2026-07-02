import { History, Download } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDonor } from "@/lib/auth/guards";
import { listDonorDonations } from "@/lib/queries/donor";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Donation history" };

const statusVariant: Record<string, "success" | "destructive" | "warning" | "neutral"> = {
  succeeded: "success",
  failed: "destructive",
  pending: "warning",
  refunded: "neutral",
  partially_refunded: "neutral",
};

export default async function HistoryPage() {
  const session = await requireDonor();
  const donations = await listDonorDonations(session.orgId, session.sub);

  return (
    <>
      <Topbar title="Donation history" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardContent className="p-6">
            {donations.length === 0 ? (
              <EmptyState
                icon={<History className="size-5" />}
                title="No donations yet"
                body="Once you give, your full history shows here with downloadable receipts."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Date</Th>
                  <Th>Fund</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Receipt</Th>
                </Thead>
                <tbody>
                  {donations.map((d) => (
                    <Tr key={d.id}>
                      <Td className="text-muted-foreground">
                        {new Date(d.date).toLocaleDateString("en-CA")}
                      </Td>
                      <Td className="font-medium">{d.fund}</Td>
                      <Td className="capitalize text-muted-foreground">{d.type.replace("_", " ")}</Td>
                      <Td className="text-right font-medium">
                        {formatCAD(d.amount, { maximumFractionDigits: 0 })}
                      </Td>
                      <Td className="text-right">
                        <Badge variant={statusVariant[d.status] ?? "neutral"} className="capitalize">
                          {d.status.replace("_", " ")}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        {d.receiptId ? (
                          <a
                            href={`/api/receipts/${d.receiptId}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                          >
                            <Download className="size-4" /> PDF
                          </a>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
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
