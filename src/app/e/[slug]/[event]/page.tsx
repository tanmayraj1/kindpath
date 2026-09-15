import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CalendarClock, MapPin } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Branded } from "@/components/give/branded";
import { EventCheckout } from "@/components/give/event-checkout";
import { orgPaymentReadiness } from "@/lib/payments/hosted";
import { GivingClosed } from "@/components/give/giving-closed";
import { getPublicEvent } from "@/lib/queries/events";

export async function generateMetadata({ params }: { params: { slug: string; event: string } }): Promise<Metadata> {
  const data = await getPublicEvent(params.slug, params.event);
  return { title: data ? data.event.title : "Event" };
}

export default async function EventPage({ params }: { params: { slug: string; event: string } }) {
  const data = await getPublicEvent(params.slug, params.event);
  if (!data || data.event.ticketTypes.length === 0) notFound();
  const { org, event } = data;

  const readiness = await orgPaymentReadiness(org.id);

  return (
    <Branded color={org.primaryColor} className="relative min-h-screen overflow-hidden bg-secondary/40">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[120px]" />
      <header className="container flex h-16 items-center justify-between">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="h-9 w-auto max-w-[180px] object-contain" />
        ) : (
          <Logo />
        )}
        <Badge variant={org.charityStatus === "registered" ? "success" : "neutral"}>
          {org.charityStatus === "registered" ? "Registered charity" : "Event"}
        </Badge>
      </header>

      <main className="container grid items-start gap-10 py-10 lg:grid-cols-2 lg:py-16">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{event.accent ?? "🎟️"}</span>
            <h1 className="font-display text-3xl font-bold tracking-tight">{event.title}</h1>
          </div>
          {event.description && <p className="text-lg leading-relaxed text-muted-foreground">{event.description}</p>}
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            {event.startsAt && (
              <span className="flex items-center gap-2"><CalendarClock className="size-4" /> {new Date(event.startsAt).toLocaleString("en-CA")}</span>
            )}
            {event.location && <span className="flex items-center gap-2"><MapPin className="size-4" /> {event.location}</span>}
            <span>Hosted by {org.name}</span>
          </div>
        </div>
        {readiness.status === "ready" ? (
          <EventCheckout
            org={{ slug: org.slug }}
            eventId={event.id}
            ticketTypes={event.ticketTypes}
            hosted={readiness.hosted}
          />
        ) : (
          <GivingClosed orgName={org.name} what="ticket sales" />
        )}
      </main>
    </Branded>
  );
}
