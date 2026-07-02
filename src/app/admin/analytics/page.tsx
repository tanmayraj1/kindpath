import { Topbar } from "@/components/dashboard/topbar";
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
    { label: "MRR", value: formatCAD(stats.mrr) },
    { label: "Active orgs", value: String(stats.activeOrgs) },
    { label: "On trial", value: String(stats.trialing) },
    { label: "Total processed", value: formatCAD(stats.totalValue, { notation: "compact" }) },
  ];

  return (
    <>
      <Topbar title="Analytics" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-5">
                <p className="font-display text-2xl font-bold">{c.value}</p>
                <p className="text-sm text-muted-foreground">{c.label}</p>
              </CardContent>
            </Card>
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
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", i === 0 ? "bg-brand-600" : "bg-brand-400")}
                    style={{ width: `${Math.round((o.raised / maxRaised) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
