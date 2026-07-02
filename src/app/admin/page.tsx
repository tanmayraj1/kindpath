import Link from "next/link";
import { Building2, Users, DollarSign, TrendingUp, FileCheck2 } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getPlatformStats, listOrganizations } from "@/lib/queries/admin";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Platform overview" };

export default async function AdminOverview() {
  const session = await requirePlatformAdmin();
  const [stats, orgs] = await Promise.all([getPlatformStats(), listOrganizations()]);

  const cards = [
    { label: "Active organizations", value: String(stats.activeOrgs), icon: Building2 },
    { label: "MRR", value: formatCAD(stats.mrr), icon: TrendingUp },
    { label: "Total donors", value: stats.totalDonors.toLocaleString("en-CA"), icon: Users },
    { label: "Donations processed", value: formatCAD(stats.totalValue, { notation: "compact" }), icon: DollarSign },
    { label: "Receipts issued", value: stats.receipts.toLocaleString("en-CA"), icon: FileCheck2 },
  ];

  return (
    <>
      <Topbar title="Platform overview" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="flex flex-col gap-3 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600">
                  <c.icon className="size-[18px]" />
                </span>
                <div>
                  <p className="font-display text-2xl font-bold">{c.value}</p>
                  <p className="text-sm text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            </Card>
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
