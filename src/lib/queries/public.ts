import { adminDb } from "@/lib/db";

/** Public org info for the donation page (no session). Read-only, safe fields. */
export async function getPublicOrg(slug: string) {
  const org = await adminDb.organization.findUnique({
    where: { slug },
    include: {
      funds: { where: { isActive: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!org || org.status !== "active") return null;
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    primaryColor: org.primaryColor,
    logoUrl: org.logoUrl,
    charityStatus: org.charityStatus,
    funds: org.funds.map((f) => ({ id: f.id, name: f.name })),
  };
}
