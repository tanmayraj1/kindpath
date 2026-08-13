import { HeartHandshake, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch, Pagination } from "@/components/ui/list-controls";
import { AddVolunteerForm } from "@/components/dashboard/add-volunteer-form";
import {
  VolunteerRowActions,
  IssuePassForm,
  RevokePassButton,
} from "@/components/dashboard/volunteer-actions";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listVolunteers } from "@/lib/queries/volunteers";
import { parsePageParams } from "@/lib/pagination";
import { signedPassPath } from "@/lib/pass-links";

export const metadata = { title: "Volunteers" };

function passState(p: { status: string; validUntil: Date | null }) {
  if (p.status === "revoked") return { label: "Revoked", variant: "destructive" as const };
  if (p.validUntil && p.validUntil < new Date()) return { label: "Expired", variant: "neutral" as const };
  return { label: "Active", variant: "success" as const };
}

export default async function VolunteersPage({
  searchParams,
}: {
  searchParams?: { page?: string; q?: string; size?: string };
}) {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  const pageParams = parsePageParams(searchParams);
  const { roster, activeCount, passCount } = await listVolunteers(session.orgId, pageParams);

  return (
    <>
      <Topbar title="Volunteers" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <p className="font-display text-2xl font-bold">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active volunteers</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="font-display text-2xl font-bold">{passCount}</p>
              <p className="text-sm text-muted-foreground">Active passes</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Add a volunteer</CardTitle>
            <p className="text-sm text-muted-foreground">
              Volunteers get their own login at <span className="font-mono">/login</span> where they
              can see their passes and show the QR at the door.
            </p>
          </CardHeader>
          <CardContent>
            <AddVolunteerForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Roster ({roster.total})</CardTitle>
            <ListSearch action="/dashboard/volunteers" q={pageParams.q} placeholder="Name or email…" label="Search volunteers" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {roster.rows.length === 0 ? (
              <EmptyState
                icon={<HeartHandshake className="size-5" />}
                title={pageParams.q ? "No volunteers match that search" : "No volunteers yet"}
                body={
                  pageParams.q
                    ? "Try a different name or email address."
                    : "Add your first volunteer above — then issue them a pass."
                }
              />
            ) : (
              roster.rows.map((v) => (
                <div key={v.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {v.firstName} {v.lastName}{" "}
                        <Badge variant={v.status === "active" ? "success" : "neutral"} className="ml-1 capitalize">
                          {v.status}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.email}
                        {v.phone ? ` · ${v.phone}` : ""}
                        {v.role ? ` · ${v.role}` : ""}
                      </p>
                    </div>
                    <VolunteerRowActions volunteerId={v.id} status={v.status} />
                  </div>

                  {v.passes.length > 0 && (
                    <ul className="mt-3 flex flex-col gap-2">
                      {v.passes.map((p) => {
                        const s = passState(p);
                        return (
                          <li
                            key={p.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-medium">{p.title}</span>
                              <span className="font-mono text-xs text-muted-foreground">{p.serial}</span>
                              <Badge variant={s.variant}>{s.label}</Badge>
                              {p.validUntil && (
                                <span className="text-xs text-muted-foreground">
                                  until {new Date(p.validUntil).toLocaleDateString("en-CA")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Link
                                href={signedPassPath(p.id)}
                                target="_blank"
                                className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                              >
                                Verification page <ExternalLink className="size-3" />
                              </Link>
                              {p.status === "active" && <RevokePassButton passId={p.id} />}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {v.status === "active" && (
                    <div className="mt-3 border-t border-border pt-3">
                      <IssuePassForm volunteerId={v.id} />
                    </div>
                  )}
                </div>
              ))
            )}
            <Pagination basePath="/dashboard/volunteers" data={roster} noun="volunteers" />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
