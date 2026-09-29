"use server";

import { revalidatePath } from "next/cache";
import { requireOrgUser } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { normalizeBrandColor } from "@/lib/brand-color";

export type BrandColorState = { error?: string; ok?: boolean; color?: string | null };

/**
 * Save the org's brand colour on its own.
 *
 * It used to ride on the "Organization & receipts" form, which meant a colour
 * change could only be saved together with the CRA number, address and receipt
 * policy — and any problem in those fields (reported at the top of a long form,
 * far from the Save button) silently blocked it. Branding is cosmetic; it must
 * not depend on receipt data validating.
 *
 * An empty value resets to the KindPath default.
 */
export async function saveBrandColor(
  _prev: BrandColorState,
  formData: FormData
): Promise<BrandColorState> {
  const session = await requireOrgUser();

  const raw = String(formData.get("primaryColor") ?? "").trim();
  const color = raw === "" ? null : normalizeBrandColor(raw);
  if (raw !== "" && !color) {
    return { error: "Use a 6-digit colour code like #1F7A6D, or pick one from the palette." };
  }

  const org = await withTenant(session.orgId, (tx) =>
    tx.organization.update({
      where: { id: session.orgId },
      data: { primaryColor: color },
      select: { slug: true },
    })
  );

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  revalidatePath(`/give/${org.slug}`);
  return { ok: true, color };
}
