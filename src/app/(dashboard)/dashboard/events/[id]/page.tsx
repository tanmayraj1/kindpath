import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, DollarSign, Users, Receipt } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { AddTicketTypeForm } from "@/components/dashboard/add-ticket-type-form";
import { EventStatusButton } from "@/components/dashboard/event-status-button";
import { EditEventButton, EditTicketTypeButton } from "@/components/dashboard/entity-edit-buttons";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { getEvent } from "@/lib/queries/events";
import { getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export default async function EventDetail({ params }: { params: { id: string } }) {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "events");
  const [e, org] = await Promise.all([getEvent(session.orgId, params.id), getOrg(session.orgId)]);
  if (!e) notFound();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const stats = [
    { label: "Raised", value: formatCAD(e.raised, { maximumFractionDigits: 0 }), icon: DollarSign },
    { label: "Orders", value: String(e.orders), icon: Users },
    { label: "Tax-eligible total", value: formatCAD(e.eligibleTotal, { maximumFractionDigits: 0 }), icon: Receipt },
  ];

  return (
    <>
      <Topbar title="Event" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Link href="/dashboard/events" className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> All events
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{e.accent ?? "🎟️"}</span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold">{e.title}</h2>
                <Badge variant={e.status === "published" ? "success" : "neutral"} className="capitalize">{e.status}</Badge>
              </div>
              {e.startsAt && <p className="text-sm text-muted-foreground">{new Date(e.startsAt).toLocaleString("en-CA")}{e.location ? ` · ${e.location}` : ""}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <a href={`${appUrl}/e/${org?.slug}/${e.slug}`} target="_blank" rel="noopener" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3.5 text-sm font-medium hover:bg-secondary">
              <ExternalLink className="size-4" /> Public page
            </a>
            <EditEventButton event={e} />
            <EventStatusButton id={e.id} status={e.status} />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="flex items-center gap-3 p-5">
                <span className="grid size-9 place-items-center rounded-lg bg-brand-50 text-brand-600"><s.icon className="size-[18px]" /></span>
                <div>
                  <p className="font-display text-xl font-bold">{s.value}</p>
                  <p className="text-sm text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ticket types</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Table>
              <Thead>
                <Th>Name</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Advantage</Th>
                <Th className="text-right">Eligible</Th>
                <Th className="text-right">Edit</Th>
              </Thead>
              <tbody>
                {e.ticketTypes.map((t) => (
                  <Tr key={t.id}>
                    <Td className="font-medium">{t.name}</Td>
                    <Td className="text-right">{formatCAD(t.price, { maximumFractionDigits: 0 })}</Td>
                    <Td className="text-right text-muted-foreground">{formatCAD(t.advantage, { maximumFractionDigits: 0 })}</Td>
                    <Td className="text-right font-medium">{formatCAD(t.price - t.advantage, { maximumFractionDigits: 0 })}</Td>
                    <Td>
                      {/* A mistyped ticket price used to be permanent — the only
                          remedy was a second ticket type beside the wrong one. */}
                      <div className="flex justify-end">
                        <EditTicketTypeButton
                          eventId={e.id}
                          ticket={{ id: t.id, name: t.name, price: t.price, advantageValue: t.advantage }}
                        />
                      </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <AddTicketTypeForm eventId={e.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Registrations ({e.registrations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {e.registrations.length === 0 ? (
              <EmptyState title="No registrations yet" body="Share the public page to sell tickets." />
            ) : (
              <Table>
                <Thead>
                  <Th>Attendee</Th>
                  <Th>Email</Th>
                  <Th>Date</Th>
                  <Th className="text-right">Paid</Th>
                </Thead>
                <tbody>
                  {e.registrations.map((r, i) => (
                    <Tr key={i}>
                      <Td className="font-medium">{r.donor}</Td>
                      <Td className="text-muted-foreground">{r.email}</Td>
                      <Td className="text-muted-foreground">{new Date(r.date).toLocaleDateString("en-CA")}</Td>
                      <Td className="text-right font-medium">{formatCAD(r.amount, { maximumFractionDigits: 0 })}</Td>
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
