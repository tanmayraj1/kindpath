import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/tenant";
import { paged, type PageParams } from "@/lib/pagination";

/** Roster with passes, newest first — paginated and searchable. */
export function listVolunteers(orgId: string, page?: PageParams) {
  return withTenant(orgId, async (tx) => {
    const q = page?.q ?? "";
    const where: Prisma.VolunteerWhereInput = q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" as const } },
            { lastName: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};
    // The headline counts are DB counts over the whole roster, not the page. Once
    // the list is paginated, deriving them from the rows on screen would make
    // "12 active volunteers" mean "12 on this page".
    const [total, rows, activeCount, passCount] = await Promise.all([
      tx.volunteer.count({ where }),
      tx.volunteer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { passes: { orderBy: { issuedAt: "desc" } } },
        ...(page ? { skip: page.skip, take: page.size } : {}),
      }),
      tx.volunteer.count({ where: { status: "active" } }),
      tx.volunteerPass.count({ where: { status: "active" } }),
    ]);
    return {
      roster: page
        ? paged(rows, total, page)
        : paged(rows, total, { page: 1, size: rows.length || 1, q: "", skip: 0 }),
      activeCount,
      passCount,
    };
  });
}

export function getVolunteer(orgId: string, volunteerId: string) {
  return withTenant(orgId, (tx) =>
    tx.volunteer.findUnique({
      where: { id: volunteerId },
      include: { passes: { orderBy: { issuedAt: "desc" } } },
    })
  );
}

/** A volunteer's own passes (volunteer portal). */
export function listOwnPasses(orgId: string, volunteerId: string) {
  return withTenant(orgId, (tx) =>
    tx.volunteerPass.findMany({
      where: { volunteerId },
      orderBy: { issuedAt: "desc" },
      include: { org: { select: { name: true, logoUrl: true, primaryColor: true } } },
    })
  );
}
