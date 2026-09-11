import Link from "next/link";
import { Ticket, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateEventForm } from "@/components/dashboard/create-event-form";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listEvents } from "@/lib/queries/events";
import { getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";
import { appUrl as deploymentUrl } from "@/lib/app-url";

export const metadata = { title: "Events" };

export default async function EventsPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "events");
  const [events, org] = await Promise.all([listEvents(session.orgId), getOrg(session.orgId)]);
  const appUrl = deploymentUrl();

  return (
    <>
      <Topbar title="Events" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>New event</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sell tickets with automatic CRA split-receipting (price − advantage = eligible amount).
            </p>
          </CardHeader>
          <CardContent>
            <CreateEventForm />
          </CardContent>
        </Card>

        {events.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState icon={<Ticket className="size-5" />} title="No events yet" body="Create your first ticketed event above." />
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <Card key={e.id} interactive>
                <CardContent className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between">
                    <Link href={`/dashboard/events/${e.id}`} className="font-display font-semibold hover:text-brand-600">
                      {e.title}
                    </Link>
                    <Badge variant={e.status === "published" ? "success" : "neutral"} className="capitalize">{e.status}</Badge>
                  </div>
                  {e.startsAt && <p className="text-sm text-muted-foreground">{new Date(e.startsAt).toLocaleString("en-CA")}</p>}
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{formatCAD(e.raised, { maximumFractionDigits: 0 })}</span>
                    <span className="text-muted-foreground">{e.orders} order{e.orders === 1 ? "" : "s"}</span>
                  </div>
                  <a href={`${appUrl}/e/${org?.slug}/${e.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
                    Public page <ExternalLink className="size-3" />
                  </a>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
