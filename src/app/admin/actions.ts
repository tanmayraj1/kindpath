"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { unusablePasswordHash, sendInvite } from "@/lib/auth/invite";
import { revokeSessions, revokeOrgSessions } from "@/lib/auth/revocation";
import { planPrice, isPlanKey } from "@/lib/plans";

export type AdminState = {
  error?: string;
  ok?: boolean;
  /** Single-use setup link, surfaced so an admin can relay it if email fails. */
  inviteUrl?: string;
  emailed?: boolean;
};

function slugify(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 40);
}

// ---- create organization (with first admin) ----
const createOrgSchema = z.object({
  name: z.string().min(2, "Organization name is required"),
  adminName: z.string().min(2, "Admin name is required"),
  adminEmail: z.string().email("Valid admin email is required"),
  charityStatus: z.enum(["registered", "non_registered"]),
  plan: z.enum(["starter", "community", "enterprise"]),
});

export async function createOrganization(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  await requirePlatformAdmin();
  const parsed = createOrgSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (await adminDb.orgUser.findFirst({ where: { email: d.adminEmail } })) {
    return { error: "An admin with that email already exists." };
  }

  let slug = slugify(d.name) || "org";
  if (await adminDb.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const price = isPlanKey(d.plan) ? planPrice(d.plan, "monthly") : 29;
  // The first admin never gets a password from us — they set their own via a
  // single-use invitation link. Nothing shared, nothing to leak, nothing to reuse.
  const passwordHash = await unusablePasswordHash();

  const org = await adminDb.organization.create({
    data: {
      name: d.name,
      slug,
      charityStatus: d.charityStatus,
      receiptLocality: "Canada",
      users: {
        create: {
          email: d.adminEmail,
          name: d.adminName,
          role: "org_admin",
          passwordHash,
          mustChangePassword: true,
        },
      },
      subscription: {
        create: {
          plan: d.plan,
          cycle: "monthly",
          priceCad: price,
          status: "trialing",
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      },
      funds: { create: [{ name: "General Fund", code: "GEN" }] },
    },
    include: { users: true },
  });

  const invite = await sendInvite({
    principal: "org",
    principalId: org.users[0].id,
    orgId: org.id,
    email: d.adminEmail,
    name: d.adminName,
    orgName: org.name,
    purpose: "invite",
  });

  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

// ---- suspend / activate / archive ----
export async function setOrgStatus(orgId: string, status: "active" | "suspended" | "archived") {
  const admin = await requirePlatformAdmin();
  await adminDb.organization.update({ where: { id: orgId }, data: { status } });
  // Suspension has to bite immediately — sessions live for 7 days otherwise, and
  // they carry full access to this tenant's donor PII.
  if (status !== "active") await revokeOrgSessions(orgId);
  await adminDb.auditLog.create({
    data: {
      orgId,
      actorType: "platform_admin",
      actorId: admin.sub,
      action: `org.${status}`,
      entityType: "organization",
      entityId: orgId,
    },
  });
  revalidatePath("/admin/organizations");
}

// ---- manually trigger a recurring-billing run (God Mode) ----
export async function runBillingNow() {
  await requirePlatformAdmin();
  const { runBilling } = await import("@/lib/billing");
  const summary = await runBilling();
  revalidatePath("/admin");
  revalidatePath("/admin/support");
  return summary;
}

async function audit(actorId: string, orgId: string, action: string, entityType?: string, entityId?: string) {
  await adminDb.auditLog.create({
    data: { orgId, actorType: "platform_admin", actorId, action, entityType, entityId },
  });
}

// ---- subscription management (plan, cycle, price, status, trial) ----
const subSchema = z.object({
  orgId: z.string().min(1),
  plan: z.enum(["starter", "community", "enterprise"]),
  cycle: z.enum(["monthly", "annual"]),
  price: z.coerce.number().min(0),
  status: z.enum(["trialing", "active", "past_due", "cancelled"]),
  trialDays: z.coerce.number().min(0).max(365).optional(),
});

export async function updateSubscription(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const parsed = subSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const trialEndsAt =
    d.status === "trialing" && d.trialDays
      ? new Date(Date.now() + d.trialDays * 24 * 60 * 60 * 1000)
      : undefined;
  const nextBillingDate =
    d.status === "active"
      ? new Date(Date.now() + (d.cycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000)
      : null;

  await adminDb.subscription.upsert({
    where: { orgId: d.orgId },
    create: {
      orgId: d.orgId,
      plan: d.plan,
      cycle: d.cycle,
      priceCad: d.price,
      status: d.status,
      trialEndsAt,
      nextBillingDate,
    },
    update: {
      plan: d.plan,
      cycle: d.cycle,
      priceCad: d.price,
      status: d.status,
      ...(trialEndsAt ? { trialEndsAt } : {}),
      nextBillingDate,
    },
  });
  await audit(admin.sub, d.orgId, `subscription.update.${d.plan}.${d.status}`, "subscription", d.orgId);
  revalidatePath(`/admin/organizations/${d.orgId}/subscription`);
  revalidatePath(`/admin/organizations/${d.orgId}`);
  revalidatePath("/admin/subscriptions");
  return { ok: true };
}

// ---- grant / revoke ACCESS (the big switches) ----
export async function revokeAccess(orgId: string) {
  const admin = await requirePlatformAdmin();
  await adminDb.organization.update({ where: { id: orgId }, data: { status: "suspended" } });
  await adminDb.subscription.updateMany({ where: { orgId }, data: { status: "cancelled" } });
  await revokeOrgSessions(orgId);
  await audit(admin.sub, orgId, "access.revoke", "organization", orgId);
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/organizations");
}

export async function grantAccess(orgId: string) {
  const admin = await requirePlatformAdmin();
  await adminDb.organization.update({ where: { id: orgId }, data: { status: "active" } });
  await adminDb.subscription.updateMany({ where: { orgId }, data: { status: "active" } });
  await audit(admin.sub, orgId, "access.grant", "organization", orgId);
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/organizations");
}

// ---- feature grant / revoke / reset-to-plan ----
export async function setFeatureOverride(
  orgId: string,
  key: string,
  state: "grant" | "revoke" | "reset"
) {
  const admin = await requirePlatformAdmin();
  const org = await adminDb.organization.findUnique({ where: { id: orgId } });
  if (!org) return;
  const overrides = { ...((org.featureOverrides as Record<string, boolean>) ?? {}) };
  if (state === "reset") delete overrides[key];
  else overrides[key] = state === "grant";

  await adminDb.organization.update({
    where: { id: orgId },
    data: { featureOverrides: overrides },
  });
  await audit(admin.sub, orgId, `feature.${state}.${key}`, "organization", orgId);
  revalidatePath(`/admin/organizations/${orgId}/features`);
}

// ---- edit org details from the platform ----
const orgDetailsSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(2, "Name is required"),
  charityStatus: z.enum(["registered", "non_registered"]),
  craRegistrationNumber: z.string().optional(),
  authorizedSignatory: z.string().optional(),
  receiptLocality: z.string().optional(),
});

export async function updateOrgDetailsAsAdmin(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const parsed = orgDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.charityStatus === "registered" && !d.craRegistrationNumber) {
    return { error: "Registered charities need a CRA registration number." };
  }
  await adminDb.organization.update({
    where: { id: d.orgId },
    data: {
      name: d.name,
      charityStatus: d.charityStatus,
      craRegistrationNumber: d.craRegistrationNumber || null,
      authorizedSignatory: d.authorizedSignatory || null,
      receiptLocality: d.receiptLocality || null,
    },
  });
  await audit(admin.sub, d.orgId, "org.update", "organization", d.orgId);
  revalidatePath(`/admin/organizations/${d.orgId}/settings`);
  revalidatePath(`/admin/organizations/${d.orgId}`);
  return { ok: true };
}

// ---- reset an org admin's password ----
export async function resetOrgUserPassword(userId: string): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const user = await adminDb.orgUser.findUnique({ where: { id: userId }, include: { org: true } });
  if (!user) return { error: "User not found." };

  // Lock the account first, then let them prove ownership of their inbox.
  await adminDb.orgUser.update({
    where: { id: userId },
    data: {
      passwordHash: await unusablePasswordHash(),
      mustChangePassword: true,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await revokeSessions("org", userId);

  const invite = await sendInvite({
    principal: "org",
    principalId: userId,
    orgId: user.orgId,
    email: user.email,
    name: user.name,
    orgName: user.org.name,
    brandColor: user.org.primaryColor,
    logoUrl: user.org.logoUrl,
    purpose: "reset",
  });
  await audit(admin.sub, user.orgId, "user.password_reset", "org_user", userId);
  revalidatePath(`/admin/organizations/${user.orgId}/users`);
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

// ---- impersonate an org admin (support) ----
export async function impersonateOrg(orgId: string) {
  const admin = await requirePlatformAdmin();
  const orgUser = await adminDb.orgUser.findFirst({
    where: { orgId, role: "org_admin" },
    include: { org: true },
  });
  if (!orgUser) return;

  await adminDb.auditLog.create({
    data: {
      orgId,
      actorType: "platform_admin",
      actorId: admin.sub,
      action: "impersonate.start",
      entityType: "org_user",
      entityId: orgUser.id,
    },
  });

  await createSession({
    sub: orgUser.id,
    kind: "org",
    role: orgUser.role,
    orgId: orgUser.orgId,
    name: orgUser.name,
    email: orgUser.email,
  });
  redirect("/dashboard");
}

// ---- per-org gateway (WeVend) merchant credentials, encrypted at rest ----
const posCredsSchema = z
  .object({
    orgId: z.string().min(1),
    mid: z.string().min(3, "Merchant ID is required").max(40),
    // WeVend has two auth shapes; exactly one identifier is required.
    email: z.string().max(254).optional().or(z.literal("")),
    wvNumber: z.string().max(60).optional().or(z.literal("")),
    password: z.string().min(8, "Merchant password must be at least 8 characters").max(200),
    termId: z.string().min(1, "Terminal ID is required").max(20),
  })
  .refine((d) => !!d.email || !!d.wvNumber, {
    message: "Enter either a merchant email or an organization (WV) number",
    path: ["email"],
  })
  .refine((d) => !d.email || z.string().email().safeParse(d.email).success, {
    message: "Enter a valid merchant email",
    path: ["email"],
  });

export async function savePosCredentials(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const parsed = posCredsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const { saveOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");
  const { invalidateOrgProvider } = await import("@/lib/payments");
  await saveOrgGatewayCredentials(d.orgId, {
    provider: "wevend",
    mid: d.mid,
    email: d.email || undefined,
    wvNumber: d.wvNumber || undefined,
    password: d.password,
    termId: d.termId,
  });
  invalidateOrgProvider(d.orgId);
  // Never log/audit the credentials themselves — only that they changed.
  await audit(admin.sub, d.orgId, "org.pos_credentials.set", "organization", d.orgId);
  revalidatePath(`/admin/organizations/${d.orgId}/settings`);
  return { ok: true };
}

export async function clearPosCredentials(orgId: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  const { clearOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");
  const { invalidateOrgProvider } = await import("@/lib/payments");
  await clearOrgGatewayCredentials(orgId);
  invalidateOrgProvider(orgId);
  await audit(admin.sub, orgId, "org.pos_credentials.cleared", "organization", orgId);
  revalidatePath(`/admin/organizations/${orgId}/settings`);
}
