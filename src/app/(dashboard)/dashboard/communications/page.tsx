import { ShieldCheck, History } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CampaignComposer } from "@/components/dashboard/campaign-composer";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { getCommsData } from "@/lib/queries/comms";
import { DeliveryFailures } from "@/components/dashboard/delivery-failures";

export const metadata = { title: "Communications" };

export default async function CommunicationsPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "communications");
  const data = await getCommsData(session.orgId);

  return (
    <>
      <Topbar title="Communications" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        {/* Undelivered transactional mail comes first — it's the only thing on
            this page that means a donor is missing something they're owed. */}
        <DeliveryFailures orgId={session.orgId} />

        <Card>
          <CardContent className="flex items-start gap-3 p-5">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">CASL-compliant by design.</strong> Only the{" "}
              {data.totalConsented} donor{data.totalConsented === 1 ? "" : "s"} who opted in to email
              can be messaged; every send includes your organization&apos;s identification and a
              one-click way to unsubscribe.
            </p>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>New campaign</CardTitle>
            </CardHeader>
            <CardContent>
              <CampaignComposer counts={data.counts} />
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader className="flex-row items-center gap-2">
              <History className="size-5 text-muted-foreground" />
              <CardTitle>Recent sends</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recent.length === 0 ? (
                <EmptyState title="No campaigns yet" body="Your sends will be logged here." />
              ) : (
                <ul className="flex flex-col gap-3 text-sm">
                  {data.recent.map((n, i) => {
                    const p = (n.payload ?? {}) as { subject?: string; segment?: string };
                    return (
                      <li key={i} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{p.subject ?? "Campaign"}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.segment ?? "all"} ·{" "}
                            {new Date(n.sentAt ?? n.createdAt).toLocaleDateString("en-CA")}
                          </p>
                        </div>
                        <Badge variant={n.status === "sent" ? "success" : "neutral"}>{n.status}</Badge>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
