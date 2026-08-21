import { TrendingUp, Building2, Hourglass, DollarSign } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getPlatformStats, listOrganizations } from "@/lib/queries/admin";
import { cn, formatCAD } from "@/lib/utils";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session = await requirePlatformAdmin();
  const [stats, orgs] = await Promise.all([getPlatformStats(), listOrganizations()]);

  const top = [...orgs].sort((a, b) => b.raised - a.raised).slice(0, 6);
  const maxRaised = Math.max(1, ...top.map((o) => o.raised));

  const cards = [
    { label: "MRR", value: formatCAD(stats.mrr), icon: TrendingUp, href: "/admin/revenue", hero: true },
    { label: "Active orgs", value: String(stats.activeOrgs), icon: Building2, href: "/admin/organizations" },
    { label: "On trial", value: String(stats.trialing), icon: Hourglass, href: "/admin/subscriptions" },
    { label: "Total processed", value: formatCAD(stats.totalValue, { notation: "compact" }), icon: DollarSign },
  ];

  return (
    <>
      <Topbar
        title="Analytics"
        subtitle="Platform revenue and the organizations driving it."
        user={{ name: session.name, email: session.email }}
      />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              icon={c.icon}
              href={c.href}
              hero={c.hero}
              className="motion-safe:animate-rise-in"
              style={{ animationDelay: `${i * 70}ms` }}
            />
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top organizations by donation volume</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {top.map((o, i) => (
              <div key={o.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{o.name}</span>
                  <span className="text-muted-foreground">
                    {formatCAD(o.raised, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {/* Lime marks the leader, periwinkle the rest — the dashboard's
                    two-series pairing, used here to answer "who is biggest" at a
                    glance without a legend. The percentage sits at the right so
                    the eye can read down a column of them. */}
                <div className="flex items-center gap-3">
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-foreground/[0.07]">
                    <div
                      className={cn("h-full rounded-full", i === 0 ? "bg-lime" : "bg-periwinkle")}
                      // Floored at 2% so an organization that HAS raised money is
                      // never drawn as an empty track. Against a leader in the
                      // millions a real $2,780 rounds to 0%, and a bar with no
                      // fill reads as missing data rather than as a small number.
                      // The label still reports the true rounded value.
                      style={{
                        width: `${o.raised > 0 ? Math.max(2, Math.round((o.raised / maxRaised) * 100)) : 0}%`,
                      }}
                    />
                  </div>
                  <span className="tnum w-11 shrink-0 text-right text-xs text-muted-foreground">
                    {o.raised > 0 && o.raised / maxRaised < 0.005
                      ? "<1%"
                      : `${Math.round((o.raised / maxRaised) * 100)}%`}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
