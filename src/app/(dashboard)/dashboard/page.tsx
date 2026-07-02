import Link from "next/link";
import {
  TrendingUp,
  Users,
  Repeat,
  FileCheck2,
  Landmark,
  Plus,
} from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCAD } from "@/lib/utils";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrgDashboard } from "@/lib/queries/org-dashboard";

const fundColors = ["bg-brand-500", "bg-accent", "bg-success", "bg-warning", "bg-brand-300"];

const statusVariant: Record<string, "success" | "destructive" | "warning" | "neutral"> = {
  succeeded: "success",
  failed: "destructive",
  pending: "warning",
  refunded: "neutral",
  partially_refunded: "neutral",
};

export default async function DashboardPage() {
  const session = await requireOrgUser();
  const data = await getOrgDashboard(session.orgId);

  const stats = [
    { label: "Raised this month", value: formatCAD(data.stats.raisedThisMonth), icon: TrendingUp },
    { label: "Active recurring donors", value: String(data.stats.activeRecurring), icon: Repeat },
    { label: "Total donors", value: String(data.stats.totalDonors), icon: Users },
    { label: "Receipts issued", value: String(data.stats.receiptsIssued), icon: FileCheck2 },
  ];

  return (
    <>
      <Topbar
        title="Overview"
        user={{ name: session.name, email: session.email }}
        action={
          <Link href="/dashboard/donations/new" className={buttonVariants({ size: "sm" })}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">New donation</span>
          </Link>
        }
      />
      <main className="flex flex-col gap-6 p-6">
        {!data.org.onboardedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Finish setting up {data.org.name}</p>
              <p className="text-xs text-muted-foreground">
                Add your receipt details, branding and plan — it takes about two minutes.
              </p>
            </div>
            <Link href="/dashboard/onboarding" className={buttonVariants({ size: "sm" })}>
              Continue setup
            </Link>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-display text-xl font-bold">
              Welcome back, {session.name.split(" ")[0]} 👋
            </p>
            <p className="text-sm text-muted-foreground">
              Here&apos;s how {data.org.name} is doing this month.
            </p>
          </div>
          <Badge variant={data.org.charityStatus === "registered" ? "success" : "warning"}>
            {data.org.charityStatus === "registered"
              ? "Registered charity"
              : "Not a registered charity"}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex flex-col gap-3 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <stat.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Recent donations</CardTitle>
              <a href="/dashboard/donors" className="text-sm font-medium text-brand-600 hover:underline">
                View all
              </a>
            </CardHeader>
            <CardContent>
              {data.recent.length === 0 ? (
                <EmptyState
                  title="No donations yet"
                  body="Donations will appear here as they come in."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="pb-3 font-medium">Donor</th>
                        <th className="pb-3 font-medium">Fund</th>
                        <th className="pb-3 font-medium">Type</th>
                        <th className="pb-3 text-right font-medium">Amount</th>
                        <th className="pb-3 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.recent.map((d, i) => (
                        <tr key={i} className="border-b border-border/60 last:border-0">
                          <td className="py-3.5">
                            <div className="flex items-center gap-3">
                              <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                                {d.donor.split(" ").map((n) => n[0]).join("")}
                              </span>
                              <span className="font-medium">{d.donor}</span>
                            </div>
                          </td>
                          <td className="py-3.5 text-muted-foreground">{d.fund}</td>
                          <td className="py-3.5 capitalize text-muted-foreground">
                            {d.type.replace("_", " ")}
                          </td>
                          <td className="py-3.5 text-right font-medium">
                            {formatCAD(d.amount, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-3.5 text-right">
                            <Badge variant={statusVariant[d.status] ?? "neutral"} className="capitalize">
                              {d.status.replace("_", " ")}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Giving by fund</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {data.funds.length === 0 ? (
                <EmptyState
                  icon={<Landmark className="size-5" />}
                  title="No fund activity"
                  body="Create funds and record donations to see the breakdown."
                />
              ) : (
                <>
                  {data.funds.map((fund, i) => (
                    <div key={fund.name} className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{fund.name}</span>
                        <span className="text-muted-foreground">
                          {formatCAD(fund.amount, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn("h-full rounded-full", fundColors[i % fundColors.length])}
                          style={{ width: `${fund.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="mt-2 rounded-xl bg-secondary/60 p-4">
                    <p className="text-sm text-muted-foreground">Total this month</p>
                    <p className="font-display text-xl font-bold">{formatCAD(data.fundTotal)}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}

function EmptyState({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      {icon && (
        <span className="grid size-10 place-items-center rounded-xl bg-secondary text-muted-foreground">
          {icon}
        </span>
      )}
      <p className="font-medium">{title}</p>
      <p className="max-w-xs text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
