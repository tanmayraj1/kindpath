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
import { Sparkline } from "@/components/ui/sparkline";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCAD } from "@/lib/utils";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrgDashboard } from "@/lib/queries/org-dashboard";
import { countDeliveryFailures } from "@/lib/queries/comms";
import { describeOrgGatewayCredentials } from "@/lib/payments/org-credentials";

// Static rather than generateMetadata: the detail pages already load their
// record inside a withTenant transaction, and Prisma calls are not deduped
// across a second metadata pass — naming the row in the tab would cost every
// one of these pages a duplicate query. The section name is what actually
// fixes the defect: without it these 13 pages fell through to the root
// layout's marketing title, so every open tab read "KindPath — Donation
// management for faith communities" and none could be told apart.
export const metadata = { title: "Overview" };

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
  // countDeliveryFailures existed with no caller. An undelivered tax receipt is
  // something the organization has to act on, so it belongs on the page they
  // actually open — not only on the communications page they may never visit.
  const [data, undelivered, gateway] = await Promise.all([
    getOrgDashboard(session.orgId),
    countDeliveryFailures(session.orgId),
    describeOrgGatewayCredentials(session.orgId),
  ]);
  // "Set up" and "can receive money" are different facts. Onboarding can be
  // finished with the gateway explicitly skipped, and a charity in that state
  // must be told so on the page it actually opens — not discover it when the
  // first month's donations never arrive.
  const gatewayMissing = Boolean(data.org.onboardedAt) && !(gateway.configured && !gateway.error);

  // Delta vs the SAME point last month — full-last-month vs partial-this-month
  // would show every org "down" for most of every month. Only shown when last
  // month had activity, so a brand-new org isn't told it's "up ∞%".
  const prev = data.stats.raisedLastMonthSamePoint;
  const deltaPct = prev > 0 ? Math.round(((data.stats.raisedThisMonth - prev) / prev) * 100) : null;

  const stats: {
    label: string;
    value: string;
    icon: typeof TrendingUp;
    delta?: { pct: number; label: string };
    /** Weekly totals — only the money card gets one; a count of donors has no
        meaningful weekly shape, and a line under every number is decoration. */
    series?: number[];
    href?: string;
    /** Lime treatment. Exactly one card per row may set this — see StatCard. */
    hero?: boolean;
  }[] = [
    {
      label: "Raised this month",
      value: formatCAD(data.stats.raisedThisMonth),
      icon: TrendingUp,
      series: data.trend,
      href: "/dashboard/reports",
      hero: true,
      ...(deltaPct !== null
        ? { delta: { pct: deltaPct, label: "vs this time last month" } }
        : {}),
    },
    { label: "Active recurring donors", value: String(data.stats.activeRecurring), icon: Repeat, href: "/dashboard/recurring" },
    { label: "Total donors", value: String(data.stats.totalDonors), icon: Users, href: "/dashboard/donors" },
    { label: "Receipts issued", value: String(data.stats.receiptsIssued), icon: FileCheck2, href: "/dashboard/receipts" },
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
        {undelivered > 0 && (
          <Link
            href="/dashboard/communications"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3 hover:bg-warning/10"
          >
            <div>
              <p className="text-sm font-semibold">
                {undelivered} message{undelivered === 1 ? "" : "s"} didn&apos;t reach{" "}
                {undelivered === 1 ? "its recipient" : "their recipients"}
              </p>
              <p className="text-xs text-muted-foreground">
                Donors are missing receipts they&apos;re owed. Review and send them again.
              </p>
            </div>
            <span className={buttonVariants({ variant: "outline", size: "sm" })}>Review</span>
          </Link>
        )}

        {!data.org.onboardedAt && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Finish setting up {data.org.name}</p>
              <p className="text-xs text-muted-foreground">
                Add your receipt details, branding, plan and payment account — about three minutes.
              </p>
            </div>
            <Link href="/dashboard/onboarding" className={buttonVariants({ size: "sm" })}>
              Continue setup
            </Link>
          </div>
        )}
        {gatewayMissing && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3">
            <div>
              <p className="text-sm font-semibold">
                {gateway.error ? "Your payment gateway can't be read" : "You can't receive donations yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                {gateway.error
                  ? "Donations are being refused rather than sent to the wrong account. Reconnect your merchant account."
                  : `Your giving page tells donors online giving is opening soon, and takes no payments, until ${data.org.name}'s WeVend merchant account is connected.`}
              </p>
            </div>
            <Link href="/dashboard/settings#payments" className={buttonVariants({ size: "sm" })}>
              Connect gateway
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

        {/* CSS stagger, not a scroll-triggered one. These cards are the first
            thing on the page and are already in view, so whileInView buys
            nothing — and it would gate the org's own numbers behind
            requestAnimationFrame, which a background tab pauses. Dashboard data
            should never need JS to have run to be readable. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, i) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              icon={stat.icon}
              href={stat.href}
              hero={stat.hero}
              caption={stat.delta?.label}
              badge={
                stat.delta
                  ? {
                      text: `${stat.delta.pct >= 0 ? "+" : ""}${stat.delta.pct}%`,
                      tone: stat.delta.pct >= 0 ? "success" : "destructive",
                    }
                  : undefined
              }
              className="motion-safe:animate-rise-in"
              style={{ animationDelay: `${i * 70}ms` }}
            >
              {stat.series && stat.series.some((n) => n > 0) && (
                <>
                  <Sparkline data={stat.series} height={30} className={stat.hero ? "text-hero-foreground" : undefined} />
                  <p className={cn("mt-1 text-[11px]", stat.hero ? "text-hero-foreground/60" : "text-muted-foreground")}>Last 12 weeks</p>
                </>
              )}
            </StatCard>
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


