import { withTenant } from "@/lib/tenant";
import { adminDb } from "@/lib/db";

export function listEvents(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const [events, sums] = await Promise.all([
      tx.event.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { ticketTypes: true } } } }),
      tx.donation.groupBy({
        by: ["eventId"],
        _sum: { amount: true },
        _count: { _all: true },
        where: { status: "succeeded", eventId: { not: null } },
      }),
    ]);
    const raised = new Map(sums.map((s) => [s.eventId, { amount: Number(s._sum.amount ?? 0), orders: s._count._all }]));
    return events.map((e) => ({
      id: e.id,
      title: e.title,
      slug: e.slug,
      status: e.status,
      startsAt: e.startsAt,
      ticketTypes: e._count.ticketTypes,
      raised: raised.get(e.id)?.amount ?? 0,
      orders: raised.get(e.id)?.orders ?? 0,
    }));
  });
}

export function getEvent(orgId: string, id: string) {
  return withTenant(orgId, async (tx) => {
    const e = await tx.event.findFirst({ where: { id }, include: { ticketTypes: { orderBy: { price: "asc" } } } });
    if (!e) return null;
    const [agg, regs] = await Promise.all([
      tx.donation.aggregate({ _sum: { amount: true, eligibleAmount: true }, _count: { _all: true }, where: { eventId: id, status: "succeeded" } }),
      tx.donation.findMany({ where: { eventId: id, status: "succeeded" }, orderBy: { receivedAt: "desc" }, include: { donor: true } }),
    ]);
    return {
      id: e.id,
      title: e.title,
      slug: e.slug,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      status: e.status,
      accent: e.accent,
      raised: Number(agg._sum.amount ?? 0),
      eligibleTotal: Number(agg._sum.eligibleAmount ?? 0),
      orders: agg._count._all,
      ticketTypes: e.ticketTypes.map((t) => ({ id: t.id, name: t.name, price: Number(t.price), advantage: Number(t.advantageValue) })),
      registrations: regs.map((r) => ({ donor: `${r.donor.firstName} ${r.donor.lastName}`, email: r.donor.email, amount: Number(r.amount), date: r.receivedAt })),
    };
  });
}

/** Public event + ticket types. */
export async function getPublicEvent(orgSlug: string, eventSlug: string) {
  const org = await adminDb.organization.findUnique({
    where: { slug: orgSlug },
    include: { events: { where: { slug: eventSlug }, include: { ticketTypes: { orderBy: { price: "asc" } } } } },
  });
  if (!org || org.status !== "active") return null;
  const e = org.events[0];
  if (!e || e.status !== "published") return null;
  const agg = await adminDb.donation.aggregate({ _sum: { amount: true }, where: { eventId: e.id, status: "succeeded" } });
  return {
    org: { id: org.id, name: org.name, slug: org.slug, charityStatus: org.charityStatus, primaryColor: org.primaryColor, logoUrl: org.logoUrl },
    event: {
      id: e.id,
      title: e.title,
      slug: e.slug,
      description: e.description,
      location: e.location,
      startsAt: e.startsAt,
      accent: e.accent,
      raised: Number(agg._sum.amount ?? 0),
      ticketTypes: e.ticketTypes.map((t) => ({ id: t.id, name: t.name, price: Number(t.price), advantage: Number(t.advantageValue) })),
    },
  };
}
