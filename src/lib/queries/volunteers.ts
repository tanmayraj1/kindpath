import { withTenant } from "@/lib/tenant";

/** Roster with pass counts, newest first. */
export function listVolunteers(orgId: string) {
  return withTenant(orgId, (tx) =>
    tx.volunteer.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        passes: { orderBy: { issuedAt: "desc" } },
      },
    })
  );
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
