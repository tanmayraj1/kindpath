import Link from "next/link";
import { Building2, Users, DollarSign, TrendingUp, FileCheck2 } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getPlatformStats, listOrganizations } from "@/lib/queries/admin";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Platform overview" };

export default async function AdminOverview() {
  const session = await requirePlatformAdmin();
  const [stats, orgs] = await Promise.all([getPlatformStats(), listOrganizations()]);

  // MRR carries the lime treatment here for the same reason "Raised this month"
  // does on the org dashboard: it is the one number this operator opens the page
  // to check. Exactly one per row — see StatCard.
  const cards = [
    { label: "MRR", value: formatCAD(stats.mrr), icon: TrendingUp, href: "/admin/revenue", hero: true },
    { label: "Active organizations", value: String(stats.activeOrgs), icon: Building2, href: "/admin/organizations" },
    { label: "Total donors", value: stats.totalDonors.toLocaleString("en-CA"), icon: Users },
    { label: "Donations processed", value: formatCAD(stats.totalValue, { notation: "compact" }), icon: DollarSign, href: "/admin/analytics" },
    { label: "Receipts issued", value: stats.receipts.toLocaleString("en-CA"), icon: FileCheck2 },
  ];

  return (
    <>
      <Topbar
        title="Platform overview"
        subtitle="Every organization on KindPath, and what the platform is earning."
        user={{ name: session.name, email: session.email }}
      />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
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
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Organizations</CardTitle>
            <Link
              href="/admin/organizations"
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Manage all
            </Link>
          </CardHeader>
          <CardContent>
            <Table>
              <Thead>
                <Th>Organization</Th>
                <Th>Plan</Th>
                <Th className="text-right">Donors</Th>
                <Th className="text-right">Raised</Th>
                <Th className="text-right">Status</Th>
              </Thead>
              <tbody>
                {orgs.slice(0, 8).map((o) => (
                  <Tr key={o.id}>
                    <Td className="font-medium">{o.name}</Td>
                    <Td className="capitalize text-muted-foreground">{o.plan}</Td>
                    <Td className="text-right text-muted-foreground">{o.donors}</Td>
                    <Td className="text-right font-medium">
                      {formatCAD(o.raised, { maximumFractionDigits: 0 })}
                    </Td>
                    <Td className="text-right">
                      <Badge variant={o.status === "active" ? "success" : "neutral"} className="capitalize">
                        {o.status}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
