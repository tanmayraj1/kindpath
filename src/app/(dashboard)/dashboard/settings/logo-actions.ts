"use server";

import { revalidatePath } from "next/cache";
import { requireOrgUser } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { getStorage } from "@/lib/storage";
import { validateImage, MAX_LOGO_BYTES } from "@/lib/storage/image";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type LogoState = { error?: string; ok?: boolean; logoUrl?: string };

/** Upload + set the org logo. Accepts PNG/JPG/WebP up to 256 KB. */
export async function uploadLogo(_prev: LogoState, formData: FormData): Promise<LogoState> {
  const session = await requireOrgUser();
  if (!(await rateLimit(`logo:${clientIp()}`, 10, 60_000)).ok) {
    return { error: "Too many uploads. Please wait a minute and try again." };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  // Guard before reading the whole thing into memory.
  if (file.size > MAX_LOGO_BYTES) {
    return { error: "That image is too large — please use one under 256 KB." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const check = validateImage(bytes, file.type);
  if (!check.ok) return { error: check.error };

  const { url } = await getStorage().put(session.orgId, bytes, check.contentType);

  await withTenant(session.orgId, (tx) =>
    tx.organization.update({ where: { id: session.orgId }, data: { logoUrl: url } })
  );
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true, logoUrl: url };
}

export async function removeLogo(): Promise<void> {
  const session = await requireOrgUser();
  await withTenant(session.orgId, (tx) =>
    tx.organization.update({ where: { id: session.orgId }, data: { logoUrl: null } })
  );
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
}
