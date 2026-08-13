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
import { audit as auditLog } from "@/lib/audit";
import { clientIp } from "@/lib/rate-limit";
import { formErrors, type FieldErrors } from "@/lib/validation";

export type AdminState = {
  error?: string;
  ok?: boolean;
  /** Per-field validation messages, keyed by input name. */
  fields?: FieldErrors;
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
export async function setOrgStatus(
  orgId: string,
  status: "active" | "suspended" | "archived"
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();

  // Report a missing org instead of throwing a raw P2025 into the error boundary.
  const org = await adminDb.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!org) return { error: "That organization no longer exists." };

  await adminDb.organization.update({ where: { id: orgId }, data: { status } });
  // Suspension has to bite immediately — sessions live for 7 days otherwise, and
  // they carry full access to this tenant's donor PII.
  if (status !== "active") await revokeOrgSessions(orgId);
  await audit(admin.sub, orgId, `org.${status}`, "organization", orgId);

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${orgId}`);
  return { ok: true };
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

/**
 * Platform-admin audit entry. `orgId` is empty for platform-wide actions.
 *
 * Delegates to the shared helper rather than writing auditLog directly: the
 * local version recorded no IP and wasn't try/caught, so a failed audit write
 * aborted the admin action itself — the exact inverse of the intended policy
 * (see src/lib/audit.ts).
 */
async function audit(actorId: string, orgId: string, action: string, entityType?: string, entityId?: string) {
  await auditLog({
    actor: { type: "platform_admin", id: actorId },
    orgId: orgId || null,
    action,
    entityType,
    entityId,
    ip: clientIp(),
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
export async function revokeAccess(orgId: string): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const exists = await adminDb.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!exists) return { error: "That organization no longer exists." };
  await adminDb.organization.update({ where: { id: orgId }, data: { status: "suspended" } });
  await adminDb.subscription.updateMany({ where: { orgId }, data: { status: "cancelled" } });
  await revokeOrgSessions(orgId);
  await audit(admin.sub, orgId, "access.revoke", "organization", orgId);
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/organizations");
  return { ok: true };
}

export async function grantAccess(orgId: string): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const exists = await adminDb.organization.findUnique({ where: { id: orgId }, select: { id: true } });
  if (!exists) return { error: "That organization no longer exists." };
  await adminDb.organization.update({ where: { id: orgId }, data: { status: "active" } });
  await adminDb.subscription.updateMany({ where: { orgId }, data: { status: "active" } });
  await audit(admin.sub, orgId, "access.grant", "organization", orgId);
  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/organizations");
  return { ok: true };
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
/**
 * Sign in as an org's admin for support. Returns an error instead of silently
 * doing nothing: an org whose only admin is disabled (or that never had one)
 * previously made "Open as admin" a button that spun and then did nothing at all,
 * with no way for support to tell why.
 */
export async function impersonateOrg(orgId: string): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const orgUser = await adminDb.orgUser.findFirst({
    where: { orgId, role: "org_admin", status: "active" },
    include: { org: true },
  });
  if (!orgUser) {
    const anyUser = await adminDb.orgUser.findFirst({ where: { orgId }, select: { status: true } });
    return {
      error: anyUser
        ? "This organization has no ACTIVE admin to open as. Re-enable one, or reset their password."
        : "This organization has no admin user yet.",
    };
  }

  await audit(admin.sub, orgId, "impersonate.start", "org_user", orgUser.id);

  await createSession({
    sub: orgUser.id,
    kind: "org",
    role: orgUser.role,
    orgId: orgUser.orgId,
    name: orgUser.name,
    email: orgUser.email,
    // Must carry the CURRENT token version. Omitting it defaults to 0, so
    // impersonating anyone whose password had ever been reset produced a session
    // that revocation immediately rejected — support was bounced straight back
    // to /login with "your access changed", for no visible reason.
    v: orgUser.tokenVersion,
  });
  redirect("/dashboard");
}

// ---- per-org gateway credentials, encrypted at rest ----
//
// Each charity connects its OWN gateway account so donations settle directly to
// them. Supports WeVend (merchant or ISV auth) and Stripe.
const posCredsSchema = z
  .object({
    orgId: z.string().min(1),
    provider: z.enum(["wevend", "stripe"]),
    // Stripe
    secretKey: z.string().max(200).optional().or(z.literal("")),
    stripeWebhookSecret: z.string().max(200).optional().or(z.literal("")),
    // WeVend
    mid: z.string().max(40).optional().or(z.literal("")),
    email: z.string().max(254).optional().or(z.literal("")),
    wvNumber: z.string().max(60).optional().or(z.literal("")),
    password: z.string().max(200).optional().or(z.literal("")),
    termId: z.string().max(20).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    if (d.provider === "stripe") {
      if (!d.secretKey) {
        ctx.addIssue({ code: "custom", path: ["secretKey"], message: "Stripe secret key is required" });
      } else if (!/^sk_(test|live)_/.test(d.secretKey)) {
        // Catch a publishable key here rather than at charge time, where it
        // surfaces as an opaque Stripe error on a donor's payment.
        ctx.addIssue({
          code: "custom",
          path: ["secretKey"],
          message: "That doesn't look like a secret key — it should start with sk_test_ or sk_live_",
        });
      }
      return;
    }
    if (!d.mid) ctx.addIssue({ code: "custom", path: ["mid"], message: "Merchant ID is required" });
    if (!d.termId) ctx.addIssue({ code: "custom", path: ["termId"], message: "Terminal ID is required" });
    if (!d.password || d.password.length < 8) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Merchant password must be at least 8 characters" });
    }
    if (!d.email && !d.wvNumber) {
      ctx.addIssue({
        code: "custom",
        path: ["email"],
        message: "Enter either a merchant email or an organization (WV) number",
      });
    }
    if (d.email && !z.string().email().safeParse(d.email).success) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Enter a valid merchant email" });
    }
  });

export async function savePosCredentials(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const parsed = posCredsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }
  const d = parsed.data;

  const { saveOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");
  const { invalidateOrgProvider } = await import("@/lib/payments");

  await saveOrgGatewayCredentials(
    d.orgId,
    d.provider === "stripe"
      ? {
          provider: "stripe",
          secretKey: d.secretKey as string,
          webhookSecret: d.stripeWebhookSecret || undefined,
        }
      : {
          provider: "wevend",
          mid: d.mid as string,
          email: d.email || undefined,
          wvNumber: d.wvNumber || undefined,
          password: d.password as string,
          termId: d.termId as string,
        }
  );
  invalidateOrgProvider(d.orgId);
  // Never log/audit the credentials themselves — only that they changed.
  await audit(admin.sub, d.orgId, `org.pos_credentials.set.${d.provider}`, "organization", d.orgId);
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

// ---- KindPath's own revenue: invoices + subscription lifecycle ----
export type InvoiceState = { error?: string; ok?: boolean; message?: string };

/** Issue this period's invoice for one org, on demand (God Mode). */
export async function issueInvoiceNow(orgId: string): Promise<InvoiceState> {
  const admin = await requirePlatformAdmin();
  const { issueInvoiceForOrg } = await import("@/lib/subscriptions");
  try {
    const result = await issueInvoiceForOrg(orgId);
    await audit(admin.sub, orgId, "subscription.invoice_issued_manually", "organization", orgId);
    revalidatePath("/admin/revenue");
    return "invoiceNumber" in result
      ? { ok: true, message: `Issued ${result.invoiceNumber}.` }
      : { error: `Not issued: ${result.skipped}.` };
  } catch (e) {
    const { captureError } = await import("@/lib/observability");
    captureError(e, { source: "admin.issueInvoiceNow", orgId });
    return { error: "Couldn't issue that invoice. The error has been logged." };
  }
}

/** Record payment received out-of-band (cheque, e-transfer, bank deposit). */
export async function markInvoicePaidAction(invoiceId: string): Promise<InvoiceState> {
  const admin = await requirePlatformAdmin();
  const { markInvoicePaid } = await import("@/lib/subscriptions");
  const result = await markInvoicePaid(invoiceId, admin.sub);
  revalidatePath("/admin/revenue");
  revalidatePath("/admin/subscriptions");
  return "error" in result ? result : { ok: true, message: "Marked paid." };
}

/** Run the whole subscription cycle now rather than waiting for the daily cron. */
export async function runSubscriptionCycleNow(): Promise<InvoiceState> {
  const admin = await requirePlatformAdmin();
  const { runSubscriptionCycle } = await import("@/lib/subscriptions");
  try {
    const s = await runSubscriptionCycle();
    await audit(admin.sub, "", "subscription.cycle_run_manually");
    revalidatePath("/admin/revenue");
    return {
      ok: true,
      message:
        `${s.trialsExpired} trial(s) ended · ${s.invoicesIssued} invoice(s) issued · ` +
        `${s.suspended} paused${s.errored ? ` · ${s.errored} error(s) logged` : ""}.`,
    };
  } catch (e) {
    const { captureError } = await import("@/lib/observability");
    captureError(e, { source: "admin.runSubscriptionCycleNow" });
    return { error: "The cycle failed to run. The error has been logged." };
  }
}

// ---- org user management (support) ----
/**
 * Support could only reset a password here. An organization that had locked
 * itself out — its one admin disabled, or the only admin account belonging to
 * someone who has left — could not be recovered at all: there was no way to
 * invite a new admin, promote an existing user, or re-enable a disabled one.
 * Those three actions are what make an org recoverable, so they belong here.
 */

const adminInviteSchema = z.object({
  orgId: z.string().min(1),
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email required").max(254),
  role: z.enum(["org_admin", "signatory", "staff"]),
});

export async function adminInviteOrgUser(
  _prev: AdminState,
  formData: FormData
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const parsed = adminInviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const org = await adminDb.organization.findUnique({ where: { id: d.orgId } });
  if (!org) return { error: "Organization not found." };

  // Login resolves an account by email alone, so a duplicate would make sign-in
  // ambiguous across organizations.
  const existing = await adminDb.orgUser.findFirst({ where: { email: d.email } });
  if (existing) {
    return {
      error:
        existing.orgId === d.orgId
          ? "That email already belongs to a user in this organization."
          : "That email is already used by a user in another organization.",
    };
  }

  const user = await adminDb.orgUser.create({
    data: {
      orgId: d.orgId,
      email: d.email,
      name: d.name,
      role: d.role,
      status: "active",
      passwordHash: await unusablePasswordHash(),
      mustChangePassword: true,
    },
  });

  const invite = await sendInvite({
    principal: "org",
    principalId: user.id,
    orgId: d.orgId,
    email: d.email,
    name: d.name,
    orgName: org.name,
    brandColor: org.primaryColor,
    logoUrl: org.logoUrl,
    purpose: "invite",
  });

  await auditLog({
    actor: { type: "platform_admin", id: admin.sub },
    orgId: d.orgId,
    action: "admin.user_invited",
    entityType: "org_user",
    entityId: user.id,
    after: { email: d.email, role: d.role },
    ip: clientIp(),
  });

  revalidatePath(`/admin/organizations/${d.orgId}/users`);
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

export async function adminSetOrgUserRole(
  userId: string,
  role: "org_admin" | "signatory" | "staff"
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const user = await adminDb.orgUser.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found." };

  // Demoting the last active admin is how an organization locks itself out.
  if (user.role === "org_admin" && role !== "org_admin") {
    const otherAdmins = await adminDb.orgUser.count({
      where: { orgId: user.orgId, role: "org_admin", status: "active", id: { not: userId } },
    });
    if (otherAdmins === 0) {
      return { error: "This is the organization's only active admin. Promote someone else first." };
    }
  }

  await adminDb.orgUser.update({ where: { id: userId }, data: { role } });
  await auditLog({
    actor: { type: "platform_admin", id: admin.sub },
    orgId: user.orgId,
    action: "admin.user_role_changed",
    entityType: "org_user",
    entityId: userId,
    before: { role: user.role },
    after: { role },
    ip: clientIp(),
  });
  revalidatePath(`/admin/organizations/${user.orgId}/users`);
  return { ok: true };
}

export async function adminSetOrgUserStatus(
  userId: string,
  status: "active" | "disabled"
): Promise<AdminState> {
  const admin = await requirePlatformAdmin();
  const user = await adminDb.orgUser.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found." };

  if (status === "disabled" && user.role === "org_admin") {
    const otherAdmins = await adminDb.orgUser.count({
      where: { orgId: user.orgId, role: "org_admin", status: "active", id: { not: userId } },
    });
    if (otherAdmins === 0) {
      return {
        error:
          "This is the organization's only active admin — disabling them would lock the organization out. Invite or promote another admin first.",
      };
    }
  }

  await adminDb.orgUser.update({ where: { id: userId }, data: { status } });

  // Sessions are stateless JWTs valid for 7 days: without bumping tokenVersion a
  // disabled account keeps full access — including donor PII — for up to a week.
  if (status === "disabled") await revokeSessions("org", userId);

  await auditLog({
    actor: { type: "platform_admin", id: admin.sub },
    orgId: user.orgId,
    action: status === "disabled" ? "admin.user_disabled" : "admin.user_enabled",
    entityType: "org_user",
    entityId: userId,
    before: { status: user.status },
    after: { status },
    ip: clientIp(),
  });
  revalidatePath(`/admin/organizations/${user.orgId}/users`);
  return { ok: true };
}
