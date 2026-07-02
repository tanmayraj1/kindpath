import Link from "next/link";
import { Repeat, CalendarClock, HandCoins, Download, AlertTriangle } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requireDonor } from "@/lib/auth/guards";
import { getDonorOverview } from "@/lib/queries/donor";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "My giving" };

const statusVariant: Record<string, "success" | "destructive" | "warning" | "neutral"> = {
  succeeded: "success",
  failed: "destructive",
  pending: "warning",
  refunded: "neutral",
};

export default async function PortalOverview() {
  const session = await requireDonor();
  const data = await getDonorOverview(session.orgId, session.sub);

  const stats = [
    { label: "Given this year", value: formatCAD(data.thisYear), icon: HandCoins },
    { label: "Lifetime giving", value: formatCAD(data.lifetime), icon: HandCoins },
    { label: "Active recurring", value: String(data.activePlans), icon: Repeat },
    {
      label: "Next gift",
      value: data.nextBilling ? new Date(data.nextBilling).toLocaleDateString("en-CA") : "—",
      icon: CalendarClock,
    },
  ];

  return (
    <>
      <Topbar title="My giving" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div>
          <p className="font-display text-xl font-bold">
            Hi {session.name.split(" ")[0]} 👋
          </p>
          <p className="text-sm text-muted-foreground">
            Your giving to {data.orgName}.
          </p>
        </div>

        {data.attentionPlans > 0 && (
          <Link
            href="/portal/recurring"
            className="flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 transition-colors hover:bg-destructive/10"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div className="text-sm">
                <p className="font-semibold text-destructive">
                  {data.attentionPlans === 1
                    ? "A recurring gift needs attention"
                    : `${data.attentionPlans} recurring gifts need attention`}
                </p>
                <p className="text-muted-foreground">
                  A payment didn&apos;t go through — review and retry it.
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-medium text-brand-600">Review →</span>
          </Link>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex flex-col gap-3 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <s.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent donations</CardTitle>
            <Link href="/portal/history" className="text-sm font-medium text-brand-600 hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {data.recent.length === 0 ? (
              <EmptyState
                icon={<HandCoins className="size-5" />}
                title="No donations yet"
                body="Your gifts will appear here."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Date</Th>
                  <Th>Fund</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Receipt</Th>
                </Thead>
                <tbody>
                  {data.recent.map((d) => (
                    <Tr key={d.id}>
                      <Td className="text-muted-foreground">
                        {new Date(d.date).toLocaleDateString("en-CA")}
                      </Td>
                      <Td className="font-medium">{d.fund}</Td>
                      <Td className="text-right font-medium">
                        {formatCAD(d.amount, { maximumFractionDigits: 0 })}
                      </Td>
                      <Td className="text-right">
                        <Badge variant={statusVariant[d.status] ?? "neutral"} className="capitalize">
                          {d.status}
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
