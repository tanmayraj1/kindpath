import Link from "next/link";
import { Megaphone, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EditCampaignButton } from "@/components/dashboard/entity-edit-buttons";
import { CampaignStatusButton } from "@/components/dashboard/campaign-status-button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateCampaignForm } from "@/components/dashboard/create-campaign-form";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listCampaigns, listFundsForOrg } from "@/lib/queries/campaigns";
import { getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "campaigns");
  const [campaigns, funds, org] = await Promise.all([
    listCampaigns(session.orgId),
    listFundsForOrg(session.orgId),
    getOrg(session.orgId),
  ]);

  return (
    <>
      <Topbar title="Campaigns" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>New campaign</CardTitle>
            <p className="text-sm text-muted-foreground">
              Create a goal-based fundraiser with a public page and live progress bar.
            </p>
          </CardHeader>
          <CardContent>
            <CreateCampaignForm funds={funds} />
          </CardContent>
        </Card>

        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                icon={<Megaphone className="size-5" />}
                title="No campaigns yet"
                body="Launch your first fundraising campaign above."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => {
              const pct = c.goal > 0 ? Math.round((c.raised / c.goal) * 100) : 0;
              return (
                <Card key={c.id} interactive>
                  <CardContent className="flex flex-col gap-3 p-5">
                    <div className="flex items-start justify-between">
                      <span className="text-2xl">{c.accent ?? "🎯"}</span>
                      <Badge variant={c.status === "active" ? "success" : "neutral"} className="capitalize">
                        {c.status}
                      </Badge>
                    </div>
                    <Link href={`/dashboard/campaigns/${c.id}`} className="font-display font-semibold hover:text-brand-600">
                      {c.title}
                    </Link>
                    <Progress value={pct} />
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{formatCAD(c.raised, { maximumFractionDigits: 0 })}</span>
                      <span className="text-muted-foreground">of {formatCAD(c.goal, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <a
                      href={`/c/${org?.slug}/${c.slug}`}
                      target="_blank"
                      rel="noopener"
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                    >
                      View public page <ExternalLink className="size-3" />
                    </a>
                    {/* A campaign could be created and never corrected: a typo in
                        the title or a wrong goal was permanent on a public page. */}
                    <div className="flex items-center justify-end gap-1 border-t border-border pt-3">
                      <EditCampaignButton campaign={c} funds={funds} />
                      <CampaignStatusButton id={c.id} status={c.status} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
