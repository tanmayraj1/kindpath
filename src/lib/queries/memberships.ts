import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/tenant";
import { adminDb } from "@/lib/db";
import { paged, type PageParams } from "@/lib/pagination";

export function listMembershipPlans(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const plans = await tx.membershipPlan.findMany({
      orderBy: { amount: "asc" },
      include: { _count: { select: { plans: { where: { status: "active" } } } } },
    });
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      amount: Number(p.amount),
      frequency: p.frequency,
      isActive: p.isActive,
      members: p._count.plans,
    }));
  });
}

/** The member roster, paginated and searchable by member name or email. */
export function listMembers(orgId: string, page?: PageParams) {
  return withTenant(orgId, async (tx) => {
    const q = page?.q ?? "";
    const where: Prisma.RecurringPlanWhereInput = {
      membershipPlanId: { not: null },
      ...(q
        ? {
            donor: {
              OR: [
                { firstName: { contains: q, mode: "insensitive" as const } },
                { lastName: { contains: q, mode: "insensitive" as const } },
                { email: { contains: q, mode: "insensitive" as const } },
              ],
            },
          }
        : {}),
    };
    const [total, plans] = await Promise.all([
      tx.recurringPlan.count({ where }),
      tx.recurringPlan.findMany({
        where,
        orderBy: { startedAt: "desc" },
        include: { donor: true, membershipPlan: true },
        ...(page ? { skip: page.skip, take: page.size } : {}),
      }),
    ]);
    const rows = plans.map((p) => ({
      id: p.id,
      member: `${p.donor.firstName} ${p.donor.lastName}`,
      email: p.donor.email,
      plan: p.membershipPlan?.name ?? "—",
      amount: Number(p.amount),
      frequency: p.frequency,
      status: p.status,
      since: p.startedAt,
      nextBillingDate: p.nextBillingDate,
    }));
    return page
      ? paged(rows, total, page)
      : paged(rows, total, { page: 1, size: rows.length || 1, q: "", skip: 0 });
  });
}

/** Public: active membership plans for an org's join page. */
export async function getPublicMembership(slug: string) {
  const org = await adminDb.organization.findUnique({
    where: { slug },
    include: { membershipPlans: { where: { isActive: true }, orderBy: { amount: "asc" } } },
  });
  if (!org || org.status !== "active") return null;
  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      charityStatus: org.charityStatus,
      primaryColor: org.primaryColor,
      logoUrl: org.logoUrl,
    },
    plans: org.membershipPlans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      amount: Number(p.amount),
      frequency: p.frequency,
    })),
  };
}
