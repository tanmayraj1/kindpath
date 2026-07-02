import { BarChart3, Download, Trophy } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { getOrgDashboard, getReportData } from "@/lib/queries/org-dashboard";
import { cn, formatCAD } from "@/lib/utils";

export const metadata = { title: "Reports" };

const fundColors = ["bg-brand-500", "bg-accent", "bg-success", "bg-warning", "bg-brand-300"];

export default async function ReportsPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "reports");
  const [data, report] = await Promise.all([
    getOrgDashboard(session.orgId),
    getReportData(session.orgId),
  ]);

  const cards = [
    { label: "Raised this month", value: formatCAD(data.stats.raisedThisMonth) },
    { label: "Total donors", value: String(data.stats.totalDonors) },
    { label: "Active recurring donors", value: String(data.stats.activeRecurring) },
    { label: "Receipts issued", value: String(data.stats.receiptsIssued) },
  ];

  const maxMonth = Math.max(1, ...report.months.map((m) => m.total));
  const exports = [
    { type: "donors", label: "Donors" },
    { type: "donations", label: "Donations" },
    { type: "receipts", label: "Receipts" },
  ];

  return (
    <>
      <Topbar title="Reports" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label}>
                <CardContent className="p-5">
                  <p className="font-display text-2xl font-bold">{c.value}</p>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* export bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Export CSV:</span>
          {exports.map((e) => (
            <a
              key={e.type}
              href={`/api/export/${e.type}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Download className="size-4" /> {e.label}
            </a>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* 12-month trend */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Giving over the last 12 months</CardTitle>
            </CardHeader>
            <CardContent>
              {report.months.every((m) => m.total === 0) ? (
                <EmptyState icon={<BarChart3 className="size-5" />} title="No data yet" />
              ) : (
                <div className="flex h-48 items-end gap-2">
                  {report.months.map((m, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex w-full flex-1 items-end" title={formatCAD(m.total)}>
                        <div
                          className="w-full rounded-t bg-brand-gradient transition-all"
                          style={{ height: `${Math.max(2, (m.total / maxMonth) * 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">{m.label}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* top donors */}
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Trophy className="size-5 text-warning" />
              <CardTitle>Top donors</CardTitle>
            </CardHeader>
            <CardContent>
              {report.topDonors.length === 0 ? (
                <EmptyState title="No donors yet" />
              ) : (
                <ol className="flex flex-col gap-3">
                  {report.topDonors.map((d, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                          {i + 1}
                        </span>
                        <span className="font-medium">{d.name}</span>
                      </span>
                      <span className="font-medium">{formatCAD(d.total, { maximumFractionDigits: 0 })}</span>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Giving by fund (this month)</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {data.funds.length === 0 ? (
              <EmptyState icon={<BarChart3 className="size-5" />} title="No data yet" body="Fund-wise reporting appears once donations come in." />
            ) : (
              data.funds.map((fund, i) => (
                <div key={fund.name} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{fund.name}</span>
                    <span className="text-muted-foreground">
                      {formatCAD(fund.amount, { maximumFractionDigits: 0 })} · {fund.pct}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn("h-full rounded-full", fundColors[i % fundColors.length])}
                      style={{ width: `${fund.pct}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
