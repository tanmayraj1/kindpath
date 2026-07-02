"use server";

import { z } from "zod";
import { withTenant } from "@/lib/tenant";
import { requireVolunteer } from "@/lib/auth/guards";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type VolunteerProfileState = { error?: string; ok?: boolean };

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters").max(200),
});

export async function changeVolunteerPassword(
  _prev: VolunteerProfileState,
  formData: FormData
): Promise<VolunteerProfileState> {
  const session = await requireVolunteer();
  if (!(await rateLimit(`vol-pw:${clientIp()}`, 5, 60_000)).ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const ok = await withTenant(session.orgId, async (tx) => {
    const me = await tx.volunteer.findUnique({ where: { id: session.sub } });
    if (!me?.passwordHash) return false;
    if (!(await verifyPassword(parsed.data.currentPassword, me.passwordHash))) return false;
    await tx.volunteer.update({
      where: { id: session.sub },
      data: { passwordHash: await hashPassword(parsed.data.newPassword) },
    });
    return true;
  });

  if (!ok) return { error: "Your current password is incorrect." };
  return { ok: true };
}
