"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { requireOrgUser } from "@/lib/auth/guards";
import { unusablePasswordHash, sendInvite } from "@/lib/auth/invite";
import { revokeSessions } from "@/lib/auth/revocation";
import { adminDb } from "@/lib/db";
import { assertFeature } from "@/lib/access";
import { audit } from "@/lib/audit";
import { captureError } from "@/lib/observability";

export type VolunteerState = {
  error?: string;
  ok?: boolean;
  /** Shown so an admin can pass the link on when email delivery is unavailable. */
  inviteUrl?: string;
  emailed?: boolean;
};

// ---------------- add volunteer ----------------
const addSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email").max(254),
  phone: z.string().max(30).optional(),
  role: z.string().max(100).optional(),
});

export async function addVolunteer(
  _prev: VolunteerState,
  formData: FormData
): Promise<VolunteerState> {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  const parsed = addSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  // Duplicate email is the ONE error we can describe; report anything else
  // honestly instead of blaming the address (the old catch-all did, which sent
  // admins hunting for a volunteer that was never there).
  const existing = await withTenant(session.orgId, (tx) =>
    tx.volunteer.findFirst({ where: { email: parsed.data.email }, select: { id: true } })
  );
  if (existing) return { error: "A volunteer with that email already exists." };

  // No shared temporary password: the account is unusable until the volunteer
  // follows their own single-use invitation link.
  const passwordHash = await unusablePasswordHash();
  let volunteerId: string;
  try {
    const created = await withTenant(session.orgId, (tx) =>
      tx.volunteer.create({
        data: { orgId: session.orgId, ...parsed.data, passwordHash, mustChangePassword: true },
      })
    );
    volunteerId = created.id;
  } catch (e) {
    if (isUniqueViolation(e)) return { error: "A volunteer with that email already exists." };
    captureError(e, { source: "volunteers.addVolunteer", orgId: session.orgId });
    return { error: "We couldn't add that volunteer. Please try again." };
  }

  const org = await adminDb.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true, primaryColor: true, logoUrl: true },
  });
  const invite = await sendInvite({
    principal: "volunteer",
    principalId: volunteerId,
    orgId: session.orgId,
    email: parsed.data.email,
    name: `${parsed.data.firstName} ${parsed.data.lastName}`,
    orgName: org?.name,
    brandColor: org?.primaryColor,
    logoUrl: org?.logoUrl,
    purpose: "invite",
  });
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "volunteer.invited",
    entityType: "volunteer",
    entityId: volunteerId,
  });

  revalidatePath("/dashboard/volunteers");
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

// ---------------- status / password ----------------
export async function setVolunteerStatus(volunteerId: string, status: "active" | "inactive") {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  await withTenant(session.orgId, (tx) =>
    tx.volunteer.update({ where: { id: volunteerId }, data: { status } })
  );
  // Deactivation must take effect now, not whenever their 7-day session expires.
  if (status === "inactive") await revokeSessions("volunteer", volunteerId);
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: `volunteer.${status}`,
    entityType: "volunteer",
    entityId: volunteerId,
  });
  revalidatePath("/dashboard/volunteers");
}

export async function resetVolunteerPassword(volunteerId: string): Promise<VolunteerState> {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");

  const volunteer = await withTenant(session.orgId, (tx) =>
    tx.volunteer.findFirst({ where: { id: volunteerId } })
  );
  if (!volunteer) return { error: "That volunteer no longer exists." };

  // Lock the account out immediately, then send a link only they can use.
  const passwordHash = await unusablePasswordHash();
  await withTenant(session.orgId, (tx) =>
    tx.volunteer.update({
      where: { id: volunteerId },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    })
  );
  await revokeSessions("volunteer", volunteerId);

  const org = await adminDb.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true, primaryColor: true, logoUrl: true },
  });
  const invite = await sendInvite({
    principal: "volunteer",
    principalId: volunteerId,
    orgId: session.orgId,
    email: volunteer.email,
    name: `${volunteer.firstName} ${volunteer.lastName}`,
    orgName: org?.name,
    brandColor: org?.primaryColor,
    logoUrl: org?.logoUrl,
    purpose: "reset",
  });
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "volunteer.password_reset",
    entityType: "volunteer",
    entityId: volunteerId,
  });

  revalidatePath("/dashboard/volunteers");
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

// ---------------- passes ----------------
const passSchema = z.object({
  volunteerId: z.string().uuid(),
  title: z.string().min(1, "Pass title is required").max(120),
  validUntil: z.string().optional(), // yyyy-mm-dd from <input type=date>
});

export async function issuePass(
  _prev: VolunteerState,
  formData: FormData
): Promise<VolunteerState> {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  const parsed = passSchema.safeParse({
    volunteerId: formData.get("volunteerId"),
    title: formData.get("title"),
    validUntil: formData.get("validUntil") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  let validUntil: Date | null = null;
  if (parsed.data.validUntil) {
    validUntil = new Date(`${parsed.data.validUntil}T23:59:59`);
    if (Number.isNaN(validUntil.getTime())) return { error: "Enter a valid expiry date." };
  }

  const serial = `VP-${new Date().getFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  await withTenant(session.orgId, (tx) =>
    tx.volunteerPass.create({
      data: {
        orgId: session.orgId,
        volunteerId: parsed.data.volunteerId,
        title: parsed.data.title,
        serial,
        validFrom: new Date(),
        validUntil,
      },
    })
  );
  revalidatePath("/dashboard/volunteers");
  return { ok: true };
}

export async function revokePass(passId: string) {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  await withTenant(session.orgId, (tx) =>
    tx.volunteerPass.update({
      where: { id: passId },
      data: { status: "revoked", revokedAt: new Date() },
    })
  );
  revalidatePath("/dashboard/volunteers");
}

/** Prisma unique-constraint violation (duplicate volunteer email within an org). */
function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
