import Link from "next/link";
import { TrendingUp, Users, Repeat, FileCheck2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { getOrgManage } from "@/lib/queries/admin";
import { getOrgDashboard } from "@/lib/queries/org-dashboard";
import { getEffectiveFeatures, FEATURES } from "@/lib/features";
import { formatCAD } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function OrgOverview({ params }: { params: { id: string } }) {
  const [org, data] = await Promise.all([getOrgManage(params.id), getOrgDashboard(params.id)]);
  if (!org) notFound();

  const features = getEffectiveFeatures(org.plan, org.featureOverrides);
  const enabled = FEATURES.filter((f) => features[f.key]);

  const stats = [
    { label: "Raised this month", value: formatCAD(data.stats.raisedThisMonth), icon: TrendingUp },
    { label: "Total donors", value: String(data.stats.totalDonors), icon: Users },
    { label: "Active recurring", value: String(data.stats.activeRecurring), icon: Repeat },
    { label: "Receipts issued", value: String(data.stats.receiptsIssued), icon: FileCheck2 },
  ];

  return (
    <div className="flex flex-col gap-6">
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

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Subscription</CardTitle>
            <Link
              href={`/admin/organizations/${org.id}/subscription`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <Row label="Plan" value={<span className="capitalize">{org.plan}</span>} />
            <Row
              label="Status"
              value={
                <Badge
                  variant={org.subscription?.status === "active" ? "success" : "warning"}
                  className="capitalize"
                >
                  {org.subscription?.status ?? "none"}
                </Badge>
              }
            />
            <Row label="Price" value={`${formatCAD(org.subscription?.price ?? 0, { maximumFractionDigits: 0 })}/mo`} />
            {org.subscription?.trialEndsAt && (
              <Row label="Trial ends" value={new Date(org.subscription.trialEndsAt).toLocaleDateString("en-CA")} />
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Enabled features ({enabled.length}/{FEATURES.length})</CardTitle>
            <Link
              href={`/admin/organizations/${org.id}/features`}
              className="text-sm font-medium text-brand-600 hover:underline"
            >
              Manage
            </Link>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {FEATURES.map((f) => (
              <span
                key={f.key}
                className={
                  features[f.key]
                    ? "inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success"
                    : "inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground line-through"
                }
              >
                {features[f.key] && <CheckCircle2 className="size-3.5" />}
                {f.label}
              </span>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent donations</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recent.length === 0 ? (
            <EmptyState title="No donations yet" body="Donations appear here as this organization starts receiving gifts." />
          ) : (
            <Table>
              <Thead>
                <Th>Donor</Th>
                <Th>Fund</Th>
                <Th className="text-right">Amount</Th>
                <Th className="text-right">Status</Th>
              </Thead>
              <tbody>
                {data.recent.map((d, i) => (
                  <Tr key={i}>
                    <Td className="font-medium">{d.donor}</Td>
                    <Td className="text-muted-foreground">{d.fund}</Td>
                    <Td className="text-right font-medium">{formatCAD(d.amount, { maximumFractionDigits: 0 })}</Td>
                    <Td className="text-right">
                      <Badge variant={d.status === "succeeded" ? "success" : "warning"} className="capitalize">
                        {d.status}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
