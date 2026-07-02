"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { requireOrgUser } from "@/lib/auth/guards";
import { hashPassword } from "@/lib/auth/password";
import { assertFeature } from "@/lib/access";

export type VolunteerState = { error?: string; ok?: boolean; tempPassword?: string };

const TEMP_PASSWORD = "ChangeMe123!";

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

  const passwordHash = await hashPassword(TEMP_PASSWORD);
  try {
    await withTenant(session.orgId, (tx) =>
      tx.volunteer.create({
        data: {
          orgId: session.orgId,
          ...parsed.data,
          passwordHash,
        },
      })
    );
  } catch {
    return { error: "A volunteer with that email already exists." };
  }
  revalidatePath("/dashboard/volunteers");
  return { ok: true, tempPassword: TEMP_PASSWORD };
}

// ---------------- status / password ----------------
export async function setVolunteerStatus(volunteerId: string, status: "active" | "inactive") {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  await withTenant(session.orgId, (tx) =>
    tx.volunteer.update({ where: { id: volunteerId }, data: { status } })
  );
  revalidatePath("/dashboard/volunteers");
}

export async function resetVolunteerPassword(volunteerId: string): Promise<VolunteerState> {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "volunteers");
  const passwordHash = await hashPassword(TEMP_PASSWORD);
  await withTenant(session.orgId, (tx) =>
    tx.volunteer.update({ where: { id: volunteerId }, data: { passwordHash } })
  );
  revalidatePath("/dashboard/volunteers");
  return { ok: true, tempPassword: TEMP_PASSWORD };
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
