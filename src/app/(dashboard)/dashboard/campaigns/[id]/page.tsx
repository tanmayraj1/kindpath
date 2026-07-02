import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Users, Target, CalendarClock } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CampaignStatusButton } from "@/components/dashboard/campaign-status-button";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { getCampaign } from "@/lib/queries/campaigns";
import { getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export default async function CampaignDetail({ params }: { params: { id: string } }) {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "campaigns");
  const [c, org] = await Promise.all([getCampaign(session.orgId, params.id), getOrg(session.orgId)]);
  if (!c) notFound();

  const pct = c.goal > 0 ? Math.round((c.raised / c.goal) * 100) : 0;

  return (
    <>
      <Topbar title="Campaign" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Link
          href="/dashboard/campaigns"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All campaigns
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{c.accent ?? "🎯"}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold">{c.title}</h2>
                <Badge variant={c.status === "active" ? "success" : "neutral"} className="capitalize">
                  {c.status}
                </Badge>
              </div>
              {c.description && <p className="text-sm text-muted-foreground">{c.description}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/c/${org?.slug}/${c.slug}`}
              target="_blank"
              rel="noopener"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-secondary"
            >
              <ExternalLink className="size-4" /> Public page
            </a>
            <CampaignStatusButton id={c.id} status={c.status} />
          </div>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-3xl font-bold text-brand-600">
                  {formatCAD(c.raised, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  raised of {formatCAD(c.goal, { maximumFractionDigits: 0 })} goal
                </p>
              </div>
              <span className="font-display text-2xl font-bold">{pct}%</span>
            </div>
            <Progress value={pct} className="h-3" />
            <div className="flex flex-wrap gap-6 pt-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Users className="size-4" /> {c.donorCount} donors</span>
              <span className="flex items-center gap-1.5"><Target className="size-4" /> {c.fund ?? "General"}</span>
              {c.deadline && (
                <span className="flex items-center gap-1.5">
                  <CalendarClock className="size-4" /> Ends {new Date(c.deadline).toLocaleDateString("en-CA")}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent gifts</CardTitle>
          </CardHeader>
          <CardContent>
            {c.recent.length === 0 ? (
              <EmptyState title="No gifts yet" body="Share the public page to start raising." />
            ) : (
              <Table>
                <Thead>
                  <Th>Donor</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Amount</Th>
                </Thead>
                <tbody>
                  {c.recent.map((g, i) => (
                    <Tr key={i}>
                      <Td className="font-medium">{g.donor}</Td>
                      <Td className="text-muted-foreground">{new Date(g.date).toLocaleDateString("en-CA")}</Td>
                      <Td className="text-right font-medium">{formatCAD(g.amount, { maximumFractionDigits: 0 })}</Td>
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
