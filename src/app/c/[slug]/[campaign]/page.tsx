import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Users, Target } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DonationFlow } from "@/components/give/donation-flow";
import { Branded } from "@/components/give/branded";
import { getPublicCampaign } from "@/lib/queries/campaigns";
import { formatCAD } from "@/lib/utils";

export async function generateMetadata({
  params,
}: {
  params: { slug: string; campaign: string };
}): Promise<Metadata> {
  const data = await getPublicCampaign(params.slug, params.campaign);
  return { title: data ? data.campaign.title : "Campaign" };
}

export default async function CampaignPublicPage({
  params,
}: {
  params: { slug: string; campaign: string };
}) {
  const data = await getPublicCampaign(params.slug, params.campaign);
  if (!data) notFound();
  const { org, campaign } = data;
  const pct = campaign.goal > 0 ? Math.round((campaign.raised / campaign.goal) * 100) : 0;

  return (
    <Branded color={org.primaryColor} className="relative min-h-screen overflow-hidden bg-secondary/40">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[120px]"
      />
      <header className="container flex h-16 items-center justify-between">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="h-9 w-auto max-w-[180px] object-contain" />
        ) : (
          <Logo />
        )}
        <Badge variant={org.charityStatus === "registered" ? "success" : "neutral"}>
          {org.charityStatus === "registered" ? "Registered charity" : "Donations"}
        </Badge>
      </header>

      <main className="container grid items-start gap-10 py-10 lg:grid-cols-2 lg:py-16">
        {/* campaign story + progress */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{campaign.accent ?? "🎯"}</span>
            <h1 className="font-display text-3xl font-bold tracking-tight">{campaign.title}</h1>
          </div>
          {campaign.description && (
            <p className="text-lg leading-relaxed text-muted-foreground">{campaign.description}</p>
          )}

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-end justify-between">
              <div>
                <p className="font-display text-3xl font-bold text-brand-600">
                  {formatCAD(campaign.raised, { maximumFractionDigits: 0 })}
                </p>
                <p className="text-sm text-muted-foreground">
                  raised of {formatCAD(campaign.goal, { maximumFractionDigits: 0 })} goal
                </p>
              </div>
              <span className="font-display text-2xl font-bold">{pct}%</span>
            </div>
            <Progress value={pct} className="mt-4 h-3" />
            <div className="mt-4 flex gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Target className="size-4" /> by {org.name}
              </span>
              {campaign.deadline && (
                <span className="flex items-center gap-1.5">
                  <Users className="size-4" />
                  Ends {new Date(campaign.deadline).toLocaleDateString("en-CA")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* donation flow */}
        <DonationFlow
          org={{
            id: org.id,
            name: org.name,
            slug: org.slug,
            charityStatus: org.charityStatus as "registered" | "non_registered",
            funds: org.funds,
          }}
          campaign={{ id: campaign.id, title: campaign.title, fundId: campaign.fundId }}
        />
      </main>
    </Branded>
  );
}
