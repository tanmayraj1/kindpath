"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { formErrors, type FieldErrors } from "@/lib/validation";
import { z } from "zod";
import { requireOrgUser, requireOrgAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { adminDb } from "@/lib/db";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { queueReceiptEmail, flushEmails } from "@/lib/notifications";
import { emailLayout, escapeHtml } from "@/lib/email";
import { formatCAD } from "@/lib/utils";
import { unusablePasswordHash, sendInvite } from "@/lib/auth/invite";
import { revokeSessions } from "@/lib/auth/revocation";

import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { captureError } from "@/lib/observability";
import { assertBillingActive } from "@/lib/access";

export type ActionState = { error?: string; ok?: boolean; fields?: FieldErrors };

/**
 * Result of a one-shot mutation triggered from a button rather than a form.
 *
 * These actions used to return `Promise<void>` and quietly do nothing when the
 * record wasn't found — a scoping bug, a stale page, or another tab having
 * deleted the row all looked identical to success. The button spun, the page
 * revalidated, and nothing had changed. Returning a result makes "it didn't
 * work" something the UI can actually say.
 */
export type MutationState = { ok?: boolean; error?: string };

const NOT_FOUND: MutationState = {
  error: "That record no longer exists, or belongs to another organization. Refresh and try again.",
};

// ---------------- team / staff management (org_admin only) ----------------
export type TeamState = {
  fields?: FieldErrors;
  error?: string;
  ok?: boolean;
  /** Single-use setup link, surfaced when email delivery is unavailable. */
  inviteUrl?: string;
  emailed?: boolean;
};

const inviteSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  email: z.string().email("Valid email required").max(254),
  role: z.enum(["org_admin", "signatory", "staff"]),
});

export async function inviteTeamMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const session = await requireOrgAdmin();
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  // email must be globally unique among org users (login resolves by email)
  if (await adminDb.orgUser.findFirst({ where: { email: d.email } })) {
    return { error: "A user with that email already exists." };
  }
  // No shared temporary password: the account is unusable until they follow
  // their own single-use invitation link.
  const passwordHash = await unusablePasswordHash();
  const created = await withTenant(session.orgId, (tx) =>
    tx.orgUser.create({
      data: {
        orgId: session.orgId,
        name: d.name,
        email: d.email,
        role: d.role,
        passwordHash,
        mustChangePassword: true,
      },
    })
  );

  const org = await adminDb.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true, primaryColor: true, logoUrl: true },
  });
  const invite = await sendInvite({
    principal: "org",
    principalId: created.id,
    orgId: session.orgId,
    email: d.email,
    name: d.name,
    orgName: org?.name,
    brandColor: org?.primaryColor,
    logoUrl: org?.logoUrl,
    purpose: "invite",
  });
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: `team.invited.${d.role}`,
    entityType: "org_user",
    entityId: created.id,
  });

  revalidatePath("/dashboard/team");
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

export async function setTeamMemberRole(
  userId: string,
  role: "org_admin" | "signatory" | "staff"
): Promise<TeamState> {
  const session = await requireOrgAdmin();
  if (userId === session.sub) return { error: "You can't change your own role." };
  const updated = await withTenant(session.orgId, async (tx) => {
    const u = await tx.orgUser.findFirst({ where: { id: userId } });
    if (!u) return false;
    await tx.orgUser.update({ where: { id: userId }, data: { role } });
    return true;
  });
  // Silence here used to be indistinguishable from success in the UI.
  if (!updated) return { error: "That team member no longer exists." };

  // Role is baked into the session token — force a fresh one so a demoted admin
  // doesn't keep admin routes until their 7-day session expires.
  await revokeSessions("org", userId);
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: `team.role.${role}`,
    entityType: "org_user",
    entityId: userId,
  });
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function setTeamMemberStatus(
  userId: string,
  status: "active" | "disabled"
): Promise<TeamState> {
  const session = await requireOrgAdmin();
  if (userId === session.sub) return { error: "You can't disable your own account." };
  const updated = await withTenant(session.orgId, async (tx) => {
    const u = await tx.orgUser.findFirst({ where: { id: userId } });
    if (!u) return false;
    await tx.orgUser.update({ where: { id: userId }, data: { status } });
    return true;
  });
  if (!updated) return { error: "That team member no longer exists." };

  // Disabling must take effect immediately — this account can read donor PII —
  // and an unused password link would let them straight back in.
  if (status === "disabled") {
    await revokeSessions("org", userId);
    const { invalidateTokensFor } = await import("@/lib/auth/password-reset");
    await invalidateTokensFor("org", userId);
  }
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: `team.${status}`,
    entityType: "org_user",
    entityId: userId,
  });
  revalidatePath("/dashboard/team");
  return { ok: true };
}

export async function resetTeamMemberPassword(userId: string): Promise<TeamState> {
  const session = await requireOrgAdmin();

  const user = await withTenant(session.orgId, (tx) =>
    tx.orgUser.findFirst({ where: { id: userId } })
  );
  if (!user) return { error: "That team member no longer exists." };

  // Lock the account, then let them prove ownership of their inbox.
  const passwordHash = await unusablePasswordHash();
  await withTenant(session.orgId, (tx) =>
    tx.orgUser.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    })
  );
  await revokeSessions("org", userId);

  const org = await adminDb.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true, primaryColor: true, logoUrl: true },
  });
  const invite = await sendInvite({
    principal: "org",
    principalId: userId,
    orgId: session.orgId,
    email: user.email,
    name: user.name,
    orgName: org?.name,
    brandColor: org?.primaryColor,
    logoUrl: org?.logoUrl,
    purpose: "reset",
  });
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "team.password_reset",
    entityType: "org_user",
    entityId: userId,
  });

  revalidatePath("/dashboard/team");
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

// ---------------- create fund ----------------
const fundSchema = z.object({
  name: z.string().min(2, "Fund name is required"),
  code: z.string().optional(),
});

export async function createFund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = fundSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code") || undefined,
  });
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }

  await withTenant(session.orgId, (tx) =>
    tx.fund.create({
      data: { orgId: session.orgId, name: parsed.data.name, code: parsed.data.code },
    })
  );
  revalidatePath("/dashboard/funds");
  return { ok: true };
}

// ---------------- update org settings ----------------
const settingsSchema = z.object({
  name: z.string().min(2, "Organization name is required").max(150),
  charityStatus: z.enum(["registered", "non_registered"]),
  craRegistrationNumber: z.string().max(30).optional(),
  authorizedSignatory: z.string().max(120).optional(),
  receiptLocality: z.string().max(120).optional(),
  // primaryColor is deliberately absent: it is saved by saveBrandColor
  // (settings/branding-actions.ts). If this form wrote it, every receipts save
  // from a form without the field would reset the org's colour to the default.
  receiptMessage: z.string().max(500).optional().or(z.literal("")),
  receiptFooter: z.string().max(500).optional().or(z.literal("")),
  receiptPrefix: z
    .string()
    .max(12)
    .regex(/^[A-Za-z0-9-]*$/, "Prefix can use letters, numbers and dashes only")
    .optional()
    .or(z.literal("")),
  // These three are READ by business logic and, until now, written by nothing —
  // which made annual receipts unusable and silently billed every org 5% GST.
  receiptMode: z.enum(["per_gift", "annual", "both"]),
  minReceiptAmount: z.coerce.number().min(0).max(1_000_000).default(0),
  province: z.string().max(2).optional().or(z.literal("")),
  addressLine1: z.string().max(200).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  postalCode: z.string().max(12).optional().or(z.literal("")),
});

export async function updateOrgSettings(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = settingsSchema.safeParse({
    name: formData.get("name"),
    charityStatus: formData.get("charityStatus"),
    craRegistrationNumber: formData.get("craRegistrationNumber") || undefined,
    authorizedSignatory: formData.get("authorizedSignatory") || undefined,
    receiptLocality: formData.get("receiptLocality") || undefined,
    receiptMessage: formData.get("receiptMessage") || undefined,
    receiptFooter: formData.get("receiptFooter") || undefined,
    receiptPrefix: formData.get("receiptPrefix") || undefined,
    receiptMode: formData.get("receiptMode") || "per_gift",
    minReceiptAmount: formData.get("minReceiptAmount") || 0,
    province: formData.get("province") || undefined,
    addressLine1: formData.get("addressLine1") || undefined,
    city: formData.get("city") || undefined,
    postalCode: formData.get("postalCode") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (parsed.data.charityStatus === "registered" && !parsed.data.craRegistrationNumber) {
    return { error: "A CRA registration number is required for registered charities." };
  }

  await withTenant(session.orgId, (tx) =>
    tx.organization.update({
      where: { id: session.orgId },
      data: {
        name: parsed.data.name,
        charityStatus: parsed.data.charityStatus,
        craRegistrationNumber: parsed.data.craRegistrationNumber,
        authorizedSignatory: parsed.data.authorizedSignatory,
        receiptLocality: parsed.data.receiptLocality,
        receiptMessage: parsed.data.receiptMessage || null,
        receiptFooter: parsed.data.receiptFooter || null,
        receiptPrefix: parsed.data.receiptPrefix || null,
        receiptMode: parsed.data.receiptMode,
        minReceiptAmount: parsed.data.minReceiptAmount,
        province: parsed.data.province || null,
        addressLine1: parsed.data.addressLine1 || null,
        city: parsed.data.city || null,
        postalCode: parsed.data.postalCode || null,
      },
    })
  );
  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  // The province drives GST vs HST on KindPath's own invoices.
  revalidatePath("/dashboard/billing");
  return { ok: true };
}

// ---------------- log a manual donation (cash / cheque / offline) ----------------
const manualSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("A valid email is required").max(254),
  amount: z.coerce.number().min(1, "Enter a valid amount").max(1_000_000),
  advantageValue: z.coerce.number().min(0).max(1_000_000).default(0),
  advantageDescription: z.string().max(300).optional(),
  type: z.enum(["cash", "cheque", "one_time"]).default("cash"),
  fundId: z.string().optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(12).optional(),
});

export async function logManualDonation(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgUser();
  // Issuing a NEW official receipt is an obligation, so it requires a live
  // subscription. Reading, exporting and re-downloading existing receipts
  // deliberately stay available — a lapsed invoice must never cut a charity off
  // from records it is legally required to keep. Donors are never blocked.
  await assertBillingActive(session.orgId);
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  if (d.advantageValue >= d.amount) {
    return { error: "The advantage value must be less than the donation amount." };
  }

  const eligible = d.amount - d.advantageValue;
  const fundId = d.fundId && d.fundId !== "none" ? d.fundId : null;
  const year = new Date().getFullYear();
  const hasAddress = !!(d.addressLine1 && d.city && d.province && d.postalCode);

  const { receiptId, mail } = await withTenant(session.orgId, async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: session.orgId } });
    if (!org) throw new Error("Org not found");
    const registered = org.charityStatus === "registered";

    const donor = await tx.donor.upsert({
      where: { orgId_email: { orgId: session.orgId, email: d.email } },
      create: {
        orgId: session.orgId,
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode: d.postalCode,
        addressStatus: hasAddress ? "complete" : "pending",
      },
      update: hasAddress
        ? {
            addressLine1: d.addressLine1,
            city: d.city,
            province: d.province,
            postalCode: d.postalCode,
            addressStatus: "complete",
          }
        : {},
    });

    const donation = await tx.donation.create({
      data: {
        orgId: session.orgId,
        donorId: donor.id,
        fundId,
        type: d.type,
        amount: d.amount,
        advantageValue: d.advantageValue,
        advantageDescription: d.advantageDescription || null,
        eligibleAmount: eligible,
        status: "succeeded",
        receivedAt: new Date(),
      },
    });

    // issue a receipt only when we have an address (CRA requires it)
    if (!hasAddress) return { receiptId: null, mail: null };

    const serial = await nextReceiptSerial(tx, session.orgId, year, org.receiptPrefix);
    const receipt = await tx.receipt.create({
      data: {
        orgId: session.orgId,
        donationId: donation.id,
        donorId: donor.id,
        serialNumber: serial,
        documentType: registered ? "official" : "confirmation",
        donorNameSnapshot: `${d.firstName} ${d.lastName}`,
        donorAddressSnapshot: formatAddress({
          addressLine1: d.addressLine1,
          city: d.city,
          province: d.province,
          postalCode: d.postalCode,
          country: "CA",
        }),
        orgNameSnapshot: org.name,
        orgRegNumberSnapshot: org.craRegistrationNumber,
        amount: d.amount,
        advantageValue: d.advantageValue,
        eligibleAmount: eligible,
        placeIssued: org.receiptLocality,
        dateDonationReceived: donation.receivedAt,
        signatoryNameSnapshot: registered ? org.authorizedSignatory : null,
        year,
      },
    });
    const mail = await queueReceiptEmail(tx, {
      orgId: session.orgId,
      donorId: donor.id,
      donorEmail: d.email,
      donorName: `${d.firstName} ${d.lastName}`,
      orgName: org.name,
      receiptId: receipt.id,
      serialNumber: receipt.serialNumber,
      eligibleAmount: eligible,
      official: registered,
      brandColor: org.primaryColor,
      logoUrl: org.logoUrl,
    });
    return { receiptId: receipt.id as string | null, mail };
  });

  if (mail) await flushEmails([mail]);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/donors");
  revalidatePath("/dashboard/receipts");
  redirect(receiptId ? `/dashboard/receipts` : `/dashboard/donors`);
}

// ---------------- pledges ----------------
const pledgeSchema = z.object({
  donorName: z.string().min(2, "Donor name is required").max(120),
  donorEmail: z.string().email().max(254).optional().or(z.literal("")),
  amount: z.coerce.number().min(1, "Set an amount").max(10_000_000),
  campaignId: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function createPledge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const { assertFeature } = await import("@/lib/access");
  await assertFeature(session.orgId, "campaigns");
  const parsed = pledgeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const campaignId = d.campaignId && d.campaignId !== "none" ? d.campaignId : null;
  await withTenant(session.orgId, async (tx) => {
    // validate campaign belongs to org if provided
    const validCampaign = campaignId && (await tx.campaign.findFirst({ where: { id: campaignId } })) ? campaignId : null;
    await tx.pledge.create({
      data: {
        orgId: session.orgId,
        donorName: d.donorName,
        donorEmail: d.donorEmail || null,
        amount: d.amount,
        campaignId: validCampaign,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        note: d.note || null,
      },
    });
  });
  revalidatePath("/dashboard/pledges");
  return { ok: true };
}

export async function setPledgeStatus(
  pledgeId: string,
  status: "open" | "fulfilled" | "cancelled"
): Promise<MutationState> {
  const session = await requireOrgUser();
  const found = await withTenant(session.orgId, async (tx) => {
    const p = await tx.pledge.findFirst({ where: { id: pledgeId } });
    if (!p) return false;
    await tx.pledge.update({ where: { id: pledgeId }, data: { status } });
    return true;
  });
  if (!found) return NOT_FOUND;
  revalidatePath("/dashboard/pledges");
  return { ok: true };
}

// ---------------- events & ticketing ----------------
const eventSchema = z.object({
  title: z.string().min(2, "Title is required").max(150),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  startsAt: z.string().optional(),
  accent: z.string().max(8).optional(),
  ticketName: z.string().min(1, "Ticket name required").max(120),
  ticketPrice: z.coerce.number().min(1, "Ticket price required").max(1_000_000),
  ticketAdvantage: z.coerce.number().min(0).max(1_000_000).default(0),
});

export async function createEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const { assertFeature } = await import("@/lib/access");
  await assertFeature(session.orgId, "events");
  const parsed = eventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.ticketAdvantage >= d.ticketPrice) {
    return { error: "Advantage value must be less than the ticket price." };
  }
  await withTenant(session.orgId, async (tx) => {
    let slug = slugify(d.title) || "event";
    if (await tx.event.findFirst({ where: { orgId: session.orgId, slug } })) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }
    await tx.event.create({
      data: {
        orgId: session.orgId,
        title: d.title,
        slug,
        description: d.description || null,
        location: d.location || null,
        startsAt: d.startsAt ? new Date(d.startsAt) : null,
        accent: d.accent || "🎟️",
        status: "published",
        ticketTypes: {
          create: { orgId: session.orgId, name: d.ticketName, price: d.ticketPrice, advantageValue: d.ticketAdvantage },
        },
      },
    });
  });
  revalidatePath("/dashboard/events");
  return { ok: true };
}

const ticketTypeSchema = z.object({
  eventId: z.string().min(1),
  name: z.string().min(1, "Name required").max(120),
  price: z.coerce.number().min(1).max(1_000_000),
  advantage: z.coerce.number().min(0).max(1_000_000).default(0),
});

export async function addTicketType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = ticketTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;
  // Subtracted from the eligible amount on the tax receipt, so an advantage at
  // or above the price would claim a gift of zero or less.
  if (d.advantage >= d.price) {
    return { error: "Advantage must be less than the price.", fields: { advantage: "Must be less than the price." } };
  }
  const created = await withTenant(session.orgId, async (tx) => {
    const ev = await tx.event.findFirst({ where: { id: d.eventId } });
    if (!ev) return false;
    await tx.ticketType.create({
      data: { orgId: session.orgId, eventId: d.eventId, name: d.name, price: d.price, advantageValue: d.advantage },
    });
    return true;
  });
  // Reported success after creating nothing when the event wasn't found, so a
  // ticket type could silently fail to exist while the form said it saved.
  if (!created) return { error: "That event no longer exists. Refresh and try again." };
  revalidatePath(`/dashboard/events/${d.eventId}`);
  return { ok: true };
}

export async function setEventStatus(
  eventId: string,
  status: "published" | "closed"
): Promise<MutationState> {
  const session = await requireOrgUser();
  const found = await withTenant(session.orgId, async (tx) => {
    const ev = await tx.event.findFirst({ where: { id: eventId } });
    if (!ev) return false;
    await tx.event.update({ where: { id: eventId }, data: { status } });
    return true;
  });
  if (!found) return NOT_FOUND;
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard/events");
  return { ok: true };
}

// ---------------- membership plans ----------------
const membershipPlanSchema = z.object({
  name: z.string().min(2, "Name is required").max(120),
  amount: z.coerce.number().min(1, "Set an amount").max(1_000_000),
  frequency: z.enum(["weekly", "monthly", "quarterly", "annual"]),
  description: z.string().max(300).optional(),
});

export async function createMembershipPlan(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const { assertFeature } = await import("@/lib/access");
  await assertFeature(session.orgId, "memberships");
  const parsed = membershipPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  await withTenant(session.orgId, (tx) =>
    tx.membershipPlan.create({
      data: {
        orgId: session.orgId,
        name: d.name,
        amount: d.amount,
        frequency: d.frequency,
        description: d.description || null,
      },
    })
  );
  revalidatePath("/dashboard/memberships");
  return { ok: true };
}

export async function setMembershipPlanActive(
  planId: string,
  isActive: boolean
): Promise<MutationState> {
  const session = await requireOrgUser();
  const found = await withTenant(session.orgId, async (tx) => {
    const p = await tx.membershipPlan.findFirst({ where: { id: planId } });
    if (!p) return false;
    await tx.membershipPlan.update({ where: { id: planId }, data: { isActive } });
    return true;
  });
  if (!found) return NOT_FOUND;
  revalidatePath("/dashboard/memberships");
  return { ok: true };
}

// ---------------- fundraising campaigns ----------------
function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50);
}

const campaignSchema = z.object({
  title: z.string().min(2, "Title is required"),
  goalAmount: z.coerce.number().min(1, "Set a goal amount"),
  fundId: z.string().optional(),
  deadline: z.string().optional(),
  accent: z.string().max(8).optional(),
  description: z.string().optional(),
});

export async function createCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = campaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const fundId = d.fundId && d.fundId !== "none" ? d.fundId : null;

  await withTenant(session.orgId, async (tx) => {
    let slug = slugify(d.title) || "campaign";
    if (await tx.campaign.findFirst({ where: { orgId: session.orgId, slug } })) {
      slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
    }
    await tx.campaign.create({
      data: {
        orgId: session.orgId,
        title: d.title,
        slug,
        goalAmount: d.goalAmount,
        fundId,
        deadline: d.deadline ? new Date(d.deadline) : null,
        accent: d.accent || "🎯",
        description: d.description || null,
        status: "active",
      },
    });
  });
  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

export async function setCampaignStatus(
  campaignId: string,
  status: "active" | "closed"
): Promise<MutationState> {
  const session = await requireOrgUser();
  const found = await withTenant(session.orgId, async (tx) => {
    const c = await tx.campaign.findFirst({ where: { id: campaignId } });
    if (!c) return false;
    await tx.campaign.update({ where: { id: campaignId }, data: { status } });
    return true;
  });
  if (!found) return NOT_FOUND;
  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
  return { ok: true };
}

// ---------------- communications campaign (CASL-gated) ----------------
export type CampaignState = {
  error?: string;
  ok?: boolean;
  /** Delivered during this request. The rest continue in the background. */
  sent?: number;
  /** Total consented recipients this campaign will reach. */
  queued?: number;
};

const emailCampaignSchema = z.object({
  segment: z.enum(["all", "recurring", "high_value", "lapsed"]),
  subject: z.string().min(3, "Add a subject").max(200),
  message: z.string().min(5, "Write a message").max(10000),
});

/**
 * Start a bulk send.
 *
 * This used to deliver the whole campaign inline — a serial loop of one HTTPS
 * call plus one UPDATE per recipient — capped at 200 recipients with no cursor,
 * so an organization with more consented donors than that could never finish a
 * send, and there was no way to resume one that died partway.
 *
 * Now the campaign is recorded first, then one batch is drained inline so a small
 * organization still sees mail land immediately. The cron drains the remainder,
 * resuming from the keyset cursor.
 */
export async function sendCampaign(_prev: CampaignState, formData: FormData): Promise<CampaignState> {
  const session = await requireOrgUser();
  const { assertFeature } = await import("@/lib/access");
  await assertFeature(session.orgId, "communications");

  if (!(await rateLimit(`campaign:${clientIp()}`, 3, 60_000)).ok) {
    return { error: "Too many sends. Please wait a minute." };
  }
  const parsed = emailCampaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { segment, subject, message } = parsed.data;

  const { countSegment } = await import("@/lib/segments");
  const recipients = await withTenant(session.orgId, (tx) => countSegment(tx, segment));
  if (recipients === 0) {
    return { error: "No consented donors match that audience." };
  }

  const campaign = await withTenant(session.orgId, (tx) =>
    tx.emailCampaign.create({
      data: {
        orgId: session.orgId,
        segment,
        subject,
        body: message,
        recipientEstimate: recipients,
        createdByUserId: session.sub,
      },
      select: { id: true },
    })
  );

  // Drain the first batch now so a typical send completes before the page
  // re-renders; the cron picks up anything past it.
  const { drainCampaignBatch } = await import("@/lib/campaign-queue");
  const first = await drainCampaignBatch(campaign.id);

  revalidatePath("/dashboard/communications");
  return { ok: true, sent: first.sent, queued: recipients };
}

// ---------------- annual consolidated receipts ----------------
export type AnnualState = { error?: string; ok?: boolean; created?: number; skipped?: number };

/** Donors per transaction. Keeps each write well inside the 5s statement timeout. */
const ANNUAL_BATCH_SIZE = 25;

/**
 * Issue consolidated annual tax receipts for a year.
 *
 * Two CRA-critical rules are enforced here:
 *
 *  1. **A gift may be receipted once.** The previous version only checked for an
 *     existing *annual* receipt, so every gift that had already been given a
 *     per-gift official receipt was silently counted again — a donor could claim
 *     the same donation twice, which puts the charity's registration at risk.
 *     Gifts already carrying a receipt are now excluded from the total.
 *  2. **Respect the org's receipting mode.** `per_gift` orgs receipt at the time
 *     of the gift; running an annual roll-up for them would duplicate everything.
 */
export async function generateAnnualReceipts(year: number): Promise<AnnualState> {
  const session = await requireOrgUser();
  await assertBillingActive(session.orgId);
  const now = new Date();
  if (year < 2000 || year > now.getFullYear()) return { error: "Pick a valid tax year." };

  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);

  const prep = await withTenant(session.orgId, async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: session.orgId } });
    if (!org) return { error: "Organization not found." as const };
    if (org.charityStatus !== "registered") {
      return { error: "Annual tax receipts are only available to registered charities." as const };
    }
    if (org.receiptMode === "per_gift") {
      return {
        error:
          "This organization issues a receipt with every gift. Switch Receipt mode to " +
          "'annual' or 'both' in Settings before running an annual roll-up.",
      };
    }

    // Succeeded gifts in the year that have NOT already been receipted.
    // `receipt: { is: null }` is what stops the double-issue.
    const sums = await tx.donation.groupBy({
      by: ["donorId"],
      _sum: { eligibleAmount: true },
      where: {
        status: "succeeded",
        receivedAt: { gte: start, lt: end },
        receipt: { is: null },
      },
    });

    const existing = await tx.receipt.findMany({
      where: { year, documentType: "annual" },
      select: { donorId: true },
    });

    return {
      org,
      sums,
      alreadyIssued: new Set(existing.map((r) => r.donorId)),
      minAmount: Number(org.minReceiptAmount ?? 0),
    };
  });

  if ("error" in prep) return { error: prep.error };
  const { org, sums, alreadyIssued, minAmount } = prep;

  const todo = sums
    .map((row) => ({ donorId: row.donorId, total: Number(row._sum.eligibleAmount ?? 0) }))
    .filter((row) => row.total > 0);

  let created = 0;
  let skipped = 0;

  // One transaction per batch rather than one for the whole org: the original
  // held a single transaction across 4 queries × N donors and timed out past
  // roughly 50 donors, leaving the run half-done.
  for (let i = 0; i < todo.length; i += ANNUAL_BATCH_SIZE) {
    const batch = todo.slice(i, i + ANNUAL_BATCH_SIZE);
    const result = await withTenant(session.orgId, async (tx) => {
      let made = 0;
      let passed = 0;
      const donors = await tx.donor.findMany({ where: { id: { in: batch.map((b) => b.donorId) } } });
      const byId = new Map(donors.map((d) => [d.id, d]));

      for (const row of batch) {
        if (alreadyIssued.has(row.donorId) || row.total < minAmount) {
          passed++;
          continue;
        }
        const donor = byId.get(row.donorId);
        if (!donor) {
          passed++;
          continue;
        }

        const serial = await nextReceiptSerial(tx, session.orgId, year, org.receiptPrefix);
        await tx.receipt.create({
          data: {
            orgId: session.orgId,
            donorId: donor.id,
            serialNumber: serial,
            documentType: "annual",
            donorNameSnapshot: [donor.firstName, donor.middleInitial, donor.lastName]
              .filter(Boolean)
              .join(" "),
            donorAddressSnapshot: formatAddress(donor),
            orgNameSnapshot: org.name,
            orgRegNumberSnapshot: org.craRegistrationNumber,
            amount: row.total,
            advantageValue: 0,
            eligibleAmount: row.total,
            placeIssued: org.receiptLocality,
            dateDonationReceived: new Date(year, 11, 31),
            signatoryNameSnapshot: org.authorizedSignatory,
            year,
          },
        });
        made++;
      }
      return { made, passed };
    });
    created += result.made;
    skipped += result.passed;
  }

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "receipts.annual_generated",
    entityType: "organization",
    entityId: session.orgId,
    after: { year, created, skipped },
  });

  revalidatePath("/dashboard/receipts");
  return { ok: true, created, skipped };
}

// ---------------- edit a donor (org admin) ----------------
const donorEditSchema = z.object({
  donorId: z.string().min(1),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  phone: z.string().max(40).optional(),
  addressLine1: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  province: z.string().max(50).optional(),
  postalCode: z.string().max(12).optional(),
  notes: z.string().max(2000).optional(),
  emailMarketing: z.string().optional(),
  smsMarketing: z.string().optional(),
});

export async function updateDonorDetails(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = donorEditSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  const emailOptIn = d.emailMarketing === "on";
  const smsOptIn = d.smsMarketing === "on";

  const saved = await withTenant(session.orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: d.donorId } });
    if (!donor) return false;
    const addressComplete = !!(d.addressLine1 && d.city && d.province && d.postalCode);
    await tx.donor.update({
      where: { id: d.donorId },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        phone: d.phone || null,
        addressLine1: d.addressLine1 || donor.addressLine1,
        city: d.city || donor.city,
        province: d.province || donor.province,
        postalCode: d.postalCode || donor.postalCode,
        addressStatus: addressComplete ? "complete" : donor.addressStatus,
        notes: d.notes || null,
        emailMarketingOptIn: emailOptIn,
        smsMarketingOptIn: smsOptIn,
        caslConsent: emailOptIn || smsOptIn ? "express" : "none",
        caslConsentAt: emailOptIn || smsOptIn ? new Date() : donor.caslConsentAt,
        caslConsentSource: "org_admin",
      },
    });
    return true;
  });
  // Previously returned ok:true even when nothing was written, so an edit to a
  // donor who had been erased or belonged to another org reported as saved.
  if (!saved) return { error: "That donor no longer exists. Refresh and try again." };
  revalidatePath(`/dashboard/donors/${d.donorId}`);
  revalidatePath("/dashboard/donors");
  return { ok: true };
}

// ---------------- org-side recurring plan controls ----------------
export async function orgUpdatePlanStatus(
  planId: string,
  action: "pause" | "resume" | "cancel"
): Promise<MutationState> {
  const session = await requireOrgUser();
  const status = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";
  const found = await withTenant(session.orgId, async (tx) => {
    const plan = await tx.recurringPlan.findFirst({ where: { id: planId } });
    if (!plan) return false;
    await tx.recurringPlan.update({
      where: { id: planId },
      data: { status, cancelledAt: action === "cancel" ? new Date() : null },
    });
    return true;
  });
  if (!found) return NOT_FOUND;

  // Cancelling someone's recurring gift on their behalf is exactly the kind of
  // action a donor later disputes. Record who did it.
  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: `recurring_plan.${action}`,
    entityType: "recurring_plan",
    entityId: planId,
  });

  revalidatePath("/dashboard/recurring");
  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------- void a receipt (e.g. on refund/correction) ----------------
export type ReceiptActionState = { error?: string; ok?: boolean; serial?: string };

/**
 * Void an issued receipt. The row is retained, never deleted — CRA requires a
 * charity to keep every receipt it issued, including spoiled ones, and to be
 * able to say who voided it and why. Both facts are audit-logged.
 */
export async function voidReceipt(receiptId: string, reason: string): Promise<ReceiptActionState> {
  const session = await requireOrgUser();
  if (!reason?.trim()) return { error: "A reason is required to void a receipt." };

  const outcome = await withTenant(session.orgId, async (tx) => {
    const receipt = await tx.receipt.findFirst({ where: { id: receiptId } });
    if (!receipt) return { error: "That receipt no longer exists." };
    if (receipt.status === "voided") return { error: "That receipt is already voided." };
    await tx.receipt.update({
      where: { id: receiptId },
      data: { status: "voided", voidReason: reason.trim() },
    });
    return { ok: true, serial: receipt.serialNumber };
  });

  if (outcome.ok) {
    await audit({
      actor: { type: "org_user", id: session.sub },
      orgId: session.orgId,
      action: "receipt.voided",
      entityType: "receipt",
      entityId: receiptId,
      after: { serialNumber: outcome.serial, reason: reason.trim() },
      ip: clientIp(),
    });
    revalidatePath("/dashboard/receipts");
  }
  return outcome;
}

/**
 * Issue a corrected receipt that replaces a voided one.
 *
 * CRA's rule for a spoiled receipt is replace-and-reference, not edit: the new
 * receipt gets its own serial and records the serial it supersedes, so the audit
 * trail from the original gift to the final receipt stays unbroken. This is what
 * `Receipt.replacesSerial` is for.
 */
export async function reissueReceipt(receiptId: string): Promise<ReceiptActionState> {
  const session = await requireOrgUser();

  const outcome = await withTenant(session.orgId, async (tx) => {
    const original = await tx.receipt.findFirst({ where: { id: receiptId } });
    if (!original) return { error: "That receipt no longer exists." };
    if (original.status !== "voided") {
      return { error: "Only a voided receipt can be reissued. Void it first." };
    }
    const existing = await tx.receipt.findFirst({
      where: { replacesSerial: original.serialNumber },
    });
    if (existing) {
      return { error: `Already replaced by receipt ${existing.serialNumber}.` };
    }

    const org = await tx.organization.findUnique({ where: { id: session.orgId } });
    if (!org) return { error: "Organization not found." };

    // Re-snapshot the donor so a corrected name/address is what appears.
    const donor = await tx.donor.findUnique({ where: { id: original.donorId } });
    if (!donor) return { error: "The donor for that receipt no longer exists." };

    const serial = await nextReceiptSerial(tx, session.orgId, original.year, org.receiptPrefix);
    const replacement = await tx.receipt.create({
      data: {
        orgId: session.orgId,
        donationId: original.donationId,
        donorId: original.donorId,
        serialNumber: serial,
        documentType: original.documentType,
        donorNameSnapshot: [donor.firstName, donor.middleInitial, donor.lastName]
          .filter(Boolean)
          .join(" "),
        donorAddressSnapshot: formatAddress(donor),
        orgNameSnapshot: org.name,
        orgRegNumberSnapshot: org.craRegistrationNumber,
        amount: original.amount,
        advantageValue: original.advantageValue,
        eligibleAmount: original.eligibleAmount,
        placeIssued: org.receiptLocality,
        dateDonationReceived: original.dateDonationReceived,
        signatoryNameSnapshot: org.authorizedSignatory,
        replacesSerial: original.serialNumber,
        year: original.year,
      },
    });
    // Distinguish "spoiled and replaced" from a plain void.
    await tx.receipt.update({ where: { id: original.id }, data: { status: "replaced" } });
    return { ok: true, serial: replacement.serialNumber, id: replacement.id };
  });

  if (outcome.ok) {
    await audit({
      actor: { type: "org_user", id: session.sub },
      orgId: session.orgId,
      action: "receipt.reissued",
      entityType: "receipt",
      entityId: (outcome as { id: string }).id,
      after: { serialNumber: outcome.serial, replaces: receiptId },
      ip: clientIp(),
    });
    revalidatePath("/dashboard/receipts");
  }
  return { error: outcome.error, ok: outcome.ok, serial: outcome.serial };
}

// ---------------- donor data rights (PIPEDA / Law 25) ----------------
export type PrivacyState = { error?: string; ok?: boolean; message?: string };

/**
 * Erase a donor's identifying data at their request, on the org's behalf.
 *
 * Not a delete. The living record is scrubbed; donations and receipts are
 * retained because the Income Tax Act requires it, and the receipt snapshots
 * preserve the name and address each receipt was issued with.
 */
export async function anonymizeDonorRecord(donorId: string): Promise<PrivacyState> {
  const session = await requireOrgUser();
  const { anonymizeDonor } = await import("@/lib/privacy");

  const result = await anonymizeDonor({
    orgId: session.orgId,
    donorId,
    requestedBy: { type: "org_user", id: session.sub },
    ip: clientIp(),
  });
  if ("error" in result) return { error: result.error };

  revalidatePath("/dashboard/donors");
  revalidatePath(`/dashboard/donors/${donorId}`);
  return {
    ok: true,
    message:
      `Personal details removed. ${result.receiptsRetained} receipt(s) and ` +
      `${result.donationsRetained} donation(s) retained for CRA records.`,
  };
}

/** A donor's own data, for an access request they made to the organization. */
export async function exportDonorRecord(donorId: string): Promise<PrivacyState & { json?: string }> {
  const session = await requireOrgUser();
  const { buildDonorExport } = await import("@/lib/privacy");

  const data = await buildDonorExport(session.orgId, donorId);
  if (!data) return { error: "That donor record no longer exists." };

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "donor.data_exported_by_org",
    entityType: "donor",
    entityId: donorId,
    ip: clientIp(),
  });
  return { ok: true, json: JSON.stringify(data, null, 2) };
}

// ---------------- editing what was previously create-only ----------------
/**
 * Nine entity types could be created and never corrected: a fund, campaign,
 * event, ticket type, membership plan, pledge, volunteer, pass, or team member.
 * A ticket priced at $250 instead of $25, or an event dated to the wrong month,
 * was permanent — the only remedy was to make a second one and leave the wrong
 * one on the public page.
 *
 * Each editor below re-checks tenancy explicitly (`findFirst` inside
 * `withTenant`) rather than trusting the id from the form, and reports when the
 * row is gone instead of silently doing nothing.
 */

const editFundSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Fund name is required").max(120),
  code: z.string().max(40).optional(),
});

export async function updateFund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editFundSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const ok = await withTenant(session.orgId, async (tx) => {
    const fund = await tx.fund.findFirst({ where: { id: d.id } });
    if (!fund) return false;
    await tx.fund.update({
      where: { id: d.id },
      data: { name: d.name, code: d.code || null },
    });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath("/dashboard/funds");
  return { ok: true };
}

/**
 * Funds are archived, never deleted: donations and receipts reference them, and
 * a receipt must keep showing the fund the gift was designated to.
 */
export async function setFundArchived(fundId: string, archived: boolean): Promise<MutationState> {
  const session = await requireOrgUser();
  const result = await withTenant(session.orgId, async (tx) => {
    const fund = await tx.fund.findFirst({ where: { id: fundId } });
    if (!fund) return "missing" as const;
    if (archived) {
      // Archiving the only place money can currently be designated would leave
      // the giving page with nothing to select.
      const remaining = await tx.fund.count({ where: { isActive: true, id: { not: fundId } } });
      if (remaining === 0) return "last" as const;
    }
    await tx.fund.update({ where: { id: fundId }, data: { isActive: !archived } });
    return "ok" as const;
  });
  if (result === "missing") return NOT_FOUND;
  if (result === "last") {
    return { error: "This is your only active fund. Create another one before archiving this." };
  }
  revalidatePath("/dashboard/funds");
  return { ok: true };
}

const editEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2, "Title is required").max(150),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  startsAt: z.string().optional(),
  accent: z.string().max(8).optional(),
});

export async function updateEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editEventSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const ok = await withTenant(session.orgId, async (tx) => {
    const ev = await tx.event.findFirst({ where: { id: d.id } });
    if (!ev) return false;
    await tx.event.update({
      where: { id: d.id },
      data: {
        title: d.title,
        description: d.description || null,
        location: d.location || null,
        startsAt: d.startsAt ? new Date(d.startsAt) : ev.startsAt,
        accent: d.accent || ev.accent,
      },
    });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath(`/dashboard/events/${d.id}`);
  revalidatePath("/dashboard/events");
  return { ok: true };
}

const editTicketTypeSchema = z.object({
  id: z.string().min(1),
  eventId: z.string().min(1),
  name: z.string().min(1, "Name required").max(120),
  price: z.coerce.number().min(1).max(1_000_000),
  advantage: z.coerce.number().min(0).max(1_000_000).default(0),
});

export async function updateTicketType(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editTicketTypeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;
  // The advantage is subtracted from the eligible amount on a tax receipt; if it
  // met or exceeded the price the receipt would claim a gift of zero or less.
  if (d.advantage >= d.price) return { error: "Advantage must be less than the price." };

  const ok = await withTenant(session.orgId, async (tx) => {
    const tt = await tx.ticketType.findFirst({ where: { id: d.id, eventId: d.eventId } });
    if (!tt) return false;
    await tx.ticketType.update({
      where: { id: d.id },
      data: { name: d.name, price: d.price, advantageValue: d.advantage },
    });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath(`/dashboard/events/${d.eventId}`);
  return { ok: true };
}

const editMembershipPlanSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Name is required").max(120),
  amount: z.coerce.number().min(1, "Set an amount").max(1_000_000),
  frequency: z.enum(["weekly", "monthly", "quarterly", "annual"]),
  description: z.string().max(300).optional(),
});

export async function updateMembershipPlan(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editMembershipPlanSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const result = await withTenant(session.orgId, async (tx) => {
    const plan = await tx.membershipPlan.findFirst({ where: { id: d.id } });
    if (!plan) return { ok: false as const };
    const members = await tx.recurringPlan.count({
      where: { membershipPlanId: d.id, status: { in: ["active", "paused"] } },
    });
    await tx.membershipPlan.update({
      where: { id: d.id },
      data: {
        name: d.name,
        amount: d.amount,
        frequency: d.frequency,
        description: d.description || null,
      },
    });
    // Existing members keep the amount they agreed to. Changing what they are
    // billed without asking them would be taking money on new terms.
    const repriced = Number(plan.amount) !== d.amount && members > 0;
    return { ok: true as const, members, repriced };
  });
  if (!result.ok) return { error: NOT_FOUND.error };
  revalidatePath("/dashboard/memberships");
  return { ok: true };
}

const editCampaignSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2, "Title is required").max(150),
  goalAmount: z.coerce.number().min(1, "Set a goal amount").max(100_000_000),
  fundId: z.string().optional(),
  deadline: z.string().optional(),
  accent: z.string().max(8).optional(),
  description: z.string().max(4000).optional(),
});

export async function updateCampaign(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editCampaignSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const ok = await withTenant(session.orgId, async (tx) => {
    const c = await tx.campaign.findFirst({ where: { id: d.id } });
    if (!c) return false;
    await tx.campaign.update({
      where: { id: d.id },
      data: {
        title: d.title,
        goalAmount: d.goalAmount,
        // The slug is intentionally NOT regenerated from the new title: it is in
        // every link already shared, printed and emailed for this campaign.
        fundId: d.fundId && d.fundId !== "none" ? d.fundId : null,
        deadline: d.deadline ? new Date(d.deadline) : null,
        accent: d.accent || c.accent,
        description: d.description || null,
      },
    });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${d.id}`);
  return { ok: true };
}

const editPledgeSchema = z.object({
  id: z.string().min(1),
  donorName: z.string().min(2, "Donor name is required").max(120),
  donorEmail: z.string().email().max(254).optional().or(z.literal("")),
  amount: z.coerce.number().min(1, "Set an amount").max(10_000_000),
  campaignId: z.string().optional(),
  dueDate: z.string().optional(),
  note: z.string().max(500).optional(),
});

export async function updatePledge(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editPledgeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const ok = await withTenant(session.orgId, async (tx) => {
    const p = await tx.pledge.findFirst({ where: { id: d.id } });
    if (!p) return false;
    await tx.pledge.update({
      where: { id: d.id },
      data: {
        donorName: d.donorName,
        donorEmail: d.donorEmail || null,
        amount: d.amount,
        campaignId: d.campaignId && d.campaignId !== "none" ? d.campaignId : null,
        dueDate: d.dueDate ? new Date(d.dueDate) : null,
        note: d.note || null,
      },
    });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath("/dashboard/pledges");
  return { ok: true };
}

const editVolunteerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("A valid email is required").max(254),
  phone: z.string().max(40).optional(),
  role: z.string().max(120).optional(),
});

export async function updateVolunteer(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const session = await requireOrgUser();
  const parsed = editVolunteerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const ok = await withTenant(session.orgId, async (tx) => {
    const v = await tx.volunteer.findFirst({ where: { id: d.id } });
    if (!v) return false;
    await tx.volunteer.update({
      where: { id: d.id },
      data: {
        firstName: d.firstName,
        lastName: d.lastName,
        email: d.email,
        phone: d.phone || null,
        role: d.role || null,
      },
    });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath("/dashboard/volunteers");
  return { ok: true };
}

const editTeamMemberSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2, "Name is required").max(120),
});

/**
 * Correct a team member's display name. The email is deliberately not editable
 * here: it is the login identity, and changing it silently would lock someone
 * out of an account they can still see listed as theirs.
 */
export async function updateTeamMember(_prev: TeamState, formData: FormData): Promise<TeamState> {
  const session = await requireOrgAdmin();
  const parsed = editTeamMemberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const e = formErrors(parsed.error);
    return { error: e.message, fields: e.fields };
  }
  const d = parsed.data;

  const ok = await withTenant(session.orgId, async (tx) => {
    const u = await tx.orgUser.findFirst({ where: { id: d.id } });
    if (!u) return false;
    await tx.orgUser.update({ where: { id: d.id }, data: { name: d.name } });
    return true;
  });
  if (!ok) return { error: NOT_FOUND.error };
  revalidatePath("/dashboard/team");
  return { ok: true };
}

// ---------------- retry an undelivered message ----------------
/**
 * Re-send a receipt or notice that never reached the donor.
 *
 * The delivery-failures panel listed what had failed and told the user to
 * "re-issue" it — with no mechanism anywhere in the product to do so, and
 * `resendNotification` already written and called from nowhere. A donor whose
 * receipt email bounced is owed a tax receipt they don't have; this is the
 * button that gets it to them.
 *
 * The email is rebuilt from the receipt rather than replayed from storage: the
 * original body is not kept, and the signed receipt link in it is time-limited,
 * so a stored copy would resend a dead link.
 */
export async function resendFailedMessage(notificationId: string): Promise<MutationState> {
  const session = await requireOrgUser();

  if (!(await rateLimit(`resend:${session.orgId}`, 30, 60_000)).ok) {
    return { error: "Too many re-sends. Please wait a minute." };
  }

  const ctx = await withTenant(session.orgId, async (tx) => {
    const n = await tx.notification.findFirst({ where: { id: notificationId } });
    if (!n || n.status === "sent" || !n.donorId) return null;

    const [donor, org] = await Promise.all([
      tx.donor.findFirst({ where: { id: n.donorId } }),
      tx.organization.findUnique({ where: { id: session.orgId } }),
    ]);
    if (!donor || !org) return null;

    // An erased donor's address is a placeholder on a reserved domain; sending
    // there would bounce forever and re-create the same failed row.
    if (donor.anonymizedAt) return "anonymized" as const;

    const receipt = await tx.receipt.findFirst({
      where: { donorId: donor.id, status: "issued" },
      orderBy: { dateIssued: "desc" },
    });
    return { donor, org, receipt };
  });

  if (ctx === "anonymized") {
    return { error: "This donor asked to be removed, so we can't email them again." };
  }
  if (!ctx) {
    return { error: "That message can't be re-sent — it may already have been delivered." };
  }
  if (!ctx.receipt) {
    return { error: "There's no issued receipt for this donor to re-send." };
  }

  const { signedReceiptUrl } = await import("@/lib/receipt-links");
  const { resendNotification } = await import("@/lib/notifications");
  const official = ctx.receipt.documentType === "official";

  const html = emailLayout({
    heading: `Thank you for your gift, ${escapeHtml(ctx.donor.firstName)}!`,
    body: `Your ${official ? "official donation receipt" : "payment confirmation"} for
      <strong>${formatCAD(Number(ctx.receipt.eligibleAmount))}</strong> is ready.
      Receipt number <strong>${escapeHtml(ctx.receipt.serialNumber)}</strong>.`,
    cta: { label: "Download receipt (PDF)", url: signedReceiptUrl(ctx.receipt.id) },
    brand: { orgName: ctx.org.name, brandColor: ctx.org.primaryColor, logoUrl: ctx.org.logoUrl },
  });

  const sent = await resendNotification(notificationId, html, ctx.donor.email);

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "notification.resent",
    entityType: "notification",
    entityId: notificationId,
    after: { delivered: sent },
  });

  revalidatePath("/dashboard/communications");
  return sent
    ? { ok: true }
    : { error: "It failed again. Check the donor's email address on their record, then try once more." };
}

// ---------------- donor portal access ----------------
/**
 * Email a donor a link to set up their giving portal.
 *
 * Donors reach the portal on their own through the link in every receipt email,
 * but support needs this for the case that link never arrived — a typo in the
 * address, a spam filter, or a donor added by staff who never received a receipt.
 *
 * Deliberately does NOT overwrite an existing password. An org admin sending an
 * invite to a donor who already has portal access should not silently lock them
 * out of it; that donor gets an ordinary reset link instead.
 */
export async function sendDonorPortalInvite(donorId: string): Promise<TeamState> {
  const session = await requireOrgUser();

  if (!(await rateLimit(`portal-invite:${session.orgId}`, 20, 60 * 60_000)).ok) {
    return { error: "Too many invites sent. Please try again later." };
  }
  if (!(await rateLimit(`portal-invite:donor:${donorId}`, 3, 60 * 60_000)).ok) {
    return { error: "That donor has been sent several links recently. Please wait an hour." };
  }

  const ctx = await withTenant(session.orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: donorId } });
    if (!donor) return null;
    const org = await tx.organization.findUnique({ where: { id: session.orgId } });
    return { donor, org };
  });
  if (!ctx?.org) return { error: "That donor no longer exists." };
  if (ctx.donor.anonymizedAt) {
    return { error: "This donor asked to be removed, so we can't send them a link." };
  }

  const hadPassword = ctx.donor.passwordHash != null;

  // A donor row exists from the moment they give, but with no password. Give it
  // an unusable one so the account is real and lockout bookkeeping has somewhere
  // to live; the link is the only way to turn it into something signable-in.
  if (!hadPassword) {
    const placeholder = await unusablePasswordHash();
    await withTenant(session.orgId, (tx) =>
      tx.donor.update({
        where: { id: donorId },
        data: { passwordHash: placeholder, mustChangePassword: true },
      })
    );
  }

  const invite = await sendInvite({
    principal: "donor",
    principalId: donorId,
    orgId: session.orgId,
    email: ctx.donor.email,
    name: `${ctx.donor.firstName} ${ctx.donor.lastName}`,
    orgName: ctx.org.name,
    brandColor: ctx.org.primaryColor,
    logoUrl: ctx.org.logoUrl,
    purpose: hadPassword ? "reset" : "invite",
  });

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "donor.portal_invited",
    entityType: "donor",
    entityId: donorId,
    after: { hadPassword },
  });

  revalidatePath(`/dashboard/donors/${donorId}`);
  return { ok: true, inviteUrl: invite.url, emailed: invite.emailed };
}

// ---------------- PAYMENT GATEWAY (ORG-OWNED) ----------------

/**
 * Let an organization connect its OWN Stripe account.
 *
 * This closed a real hole rather than adding a convenience. `saveOrgGatewayCredentials`
 * has existed since the payments seam was built, but its only caller was
 * src/app/admin/actions.ts — the PLATFORM admin panel. A charity could not connect
 * a gateway through the product at all; someone at KindPath had to do it by hand,
 * and until they did, every donation to that org ran on the platform fallback key
 * in STRIPE_SECRET_KEY and settled into whatever account that pointed at.
 *
 * requireOrgAdmin, not requireOrgUser. Most actions in this file only check that
 * the caller belongs to the org — but this one decides WHERE THE MONEY GOES, and
 * `staff` is a real role that should not be able to redirect a charity's donations.
 *
 * The credentials themselves are never logged, never audited and never returned:
 * saveOrgGatewayCredentials seals them with AES-GCM, and the audit entry records
 * only that they changed.
 */
const stripeCredsSchema = z.object({
  secretKey: z
    .string()
    .trim()
    .regex(
      /^sk_(test|live)_[A-Za-z0-9]{10,}$/,
      "That doesn't look like a Stripe secret key. It starts with sk_test_ or sk_live_ and comes from Developers → API keys."
    ),
  webhookSecret: z
    .string()
    .trim()
    .regex(/^whsec_[A-Za-z0-9]{10,}$/, "A signing secret starts with whsec_.")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export async function connectStripeAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgAdmin();

  const parsed = stripeCredsSchema.safeParse({
    secretKey: formData.get("secretKey"),
    webhookSecret: formData.get("webhookSecret") || "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Invalid input", fields: { [String(issue?.path[0])]: issue?.message ?? "" } };
  }

  // Prove the key works BEFORE storing it. Storing an unverified key means the
  // org believes it is connected and finds out otherwise when a donor's card is
  // declined — the same failure the env-var shape check exists to prevent, one
  // layer down and with a real donor attached.
  const probe = await fetch("https://api.stripe.com/v1/balance", {
    headers: { Authorization: `Bearer ${parsed.data.secretKey}` },
  }).catch(() => null);

  if (!probe || !probe.ok) {
    return {
      error:
        "Stripe rejected that key. Check you copied the whole secret key from Developers → API keys.",
      fields: { secretKey: "Stripe rejected this key" },
    };
  }

  // Working is not enough: the account must be one CAD donations can settle
  // to. The first production key passed the balance probe and then refused
  // every Checkout because the account was registered in India — see
  // src/lib/payments/stripe-account.ts.
  const { assessStripeAccount } = await import("@/lib/payments/stripe-account");
  const acctRes = await fetch("https://api.stripe.com/v1/account", {
    headers: { Authorization: `Bearer ${parsed.data.secretKey}` },
  }).catch(() => null);
  const acct = acctRes && acctRes.ok ? ((await acctRes.json()) as { country?: string }) : {};
  const assessed = assessStripeAccount(acct);
  if (!assessed.ok) {
    return { error: assessed.reason, fields: { secretKey: "Account is not Canadian" } };
  }

  const { saveOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");
  const { invalidateOrgProvider } = await import("@/lib/payments");

  await saveOrgGatewayCredentials(session.orgId, {
    provider: "stripe",
    secretKey: parsed.data.secretKey,
    webhookSecret: parsed.data.webhookSecret,
  });
  invalidateOrgProvider(session.orgId);

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "org.gateway.connected.stripe",
    entityType: "organization",
    entityId: session.orgId,
    // The mode, not the key. Which account it is matters for support; the secret
    // must never reach the audit log.
    after: { liveMode: parsed.data.secretKey.startsWith("sk_live_"), country: assessed.country },
    ip: clientIp(),
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Connect the organization's own WeVend merchant.
 *
 * Same contract as the Stripe path: prove it works BEFORE storing (the adapter's
 * probe authenticates with mid + email + password — a wrong MID fails here, not
 * at a donor's first gift), seal at rest, audit the tail only. WeVend has no
 * test/live key distinction; the environment is the platform's `WEVEND_BASE_URL`
 * and is reported to the admin rather than inferred.
 */
const wevendCredsSchema = z.object({
  mid: z.string().trim().min(3, "Merchant ID is required").max(40),
  termId: z.string().trim().min(1, "Terminal ID is required").max(20),
  // Merchant mode only. When the platform holds organization credentials these
  // stay empty and the charity's WePay password never reaches KindPath.
  email: z.string().trim().max(254).optional().or(z.literal("")),
  password: z.string().max(200).optional().or(z.literal("")),
});

export async function connectWeVendAccount(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const session = await requireOrgAdmin();

  const parsed = wevendCredsSchema.safeParse({
    mid: formData.get("mid"),
    termId: formData.get("termId"),
    email: formData.get("email") || "",
    password: formData.get("password") || "",
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Invalid input", fields: { [String(issue?.path[0])]: issue?.message ?? "" } };
  }

  const { wevendEnabled, platformHasOrgToken } = await import("@/lib/payments/offered");
  if (!wevendEnabled()) {
    return { error: "WeVend is not enabled on this platform yet. Contact KindPath support." };
  }

  // Which auth shape this merchant will be charged under — decided here, once,
  // and stored to match. Organization Global Token is WeVend's documented default
  // for this integration and means the charity never hands us a password.
  const ownLogin = Boolean(parsed.data.email && parsed.data.password);
  if (!ownLogin && !platformHasOrgToken()) {
    return {
      error:
        "This platform isn't set up with WeVend organization credentials yet, so a merchant login is required. Enter the email and password from your WeVend account.",
      fields: { email: "Required until KindPath's WeVend organization is configured" },
    };
  }
  if (!ownLogin && (parsed.data.email || parsed.data.password)) {
    return {
      error: "Enter both the WeVend login email and password, or leave both blank.",
      fields: { password: "Enter both, or neither" },
    };
  }

  const { WeVendAdapter } = await import("@/lib/payments/wevend-adapter");
  let environment: "sandbox" | "production" | "unknown";
  try {
    const adapter = ownLogin
      ? new WeVendAdapter({
          mid: parsed.data.mid,
          termId: parsed.data.termId,
          email: parsed.data.email,
          password: parsed.data.password,
          wvNumber: "", // force merchant mode
        })
      : // Organization token from the platform env; the probe checks that this
        // MID actually exists under that organization, which login alone cannot.
        new WeVendAdapter({ mid: parsed.data.mid, termId: parsed.data.termId });
    ({ environment } = await adapter.probe());
  } catch (e) {
    captureError(e, { source: "gateway.connect.wevend", orgId: session.orgId, ownLogin });
    const unknownMerchant = WeVendAdapter.isUnknownMerchant(
      e instanceof Error ? e.message : ""
    ) || /not found under this organization/i.test(e instanceof Error ? e.message : "");
    return {
      error: unknownMerchant
        ? "WeVend doesn't recognize that merchant ID. Check it against the details WeVend sent you."
        : ownLogin
          ? "WeVend rejected those credentials. Check the merchant ID, login email and password from your WeVend account."
          : "WeVend couldn't verify that merchant. Check the merchant ID and terminal ID against the details WeVend sent you.",
      fields: { mid: "WeVend could not verify this merchant" },
    };
  }

  const { saveOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");
  const { invalidateOrgProvider } = await import("@/lib/payments");

  await saveOrgGatewayCredentials(session.orgId, {
    provider: "wevend",
    mid: parsed.data.mid,
    termId: parsed.data.termId,
    // Stored only in merchant mode. Absent means "charge this merchant under the
    // platform's organization token".
    ...(ownLogin ? { email: parsed.data.email, password: parsed.data.password } : {}),
  });
  invalidateOrgProvider(session.orgId);

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "org.gateway.connected.wevend",
    entityType: "organization",
    entityId: session.orgId,
    // Never the password or the whole MID.
    after: { midTail: parsed.data.mid.slice(-4), environment, auth: ownLogin ? "merchant" : "organization" },
    ip: clientIp(),
  });

  revalidatePath("/dashboard/settings");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function disconnectGateway(): Promise<MutationState> {
  const session = await requireOrgAdmin();
  const { clearOrgGatewayCredentials } = await import("@/lib/payments/org-credentials");
  const { invalidateOrgProvider } = await import("@/lib/payments");

  await clearOrgGatewayCredentials(session.orgId);
  invalidateOrgProvider(session.orgId);

  await audit({
    actor: { type: "org_user", id: session.sub },
    orgId: session.orgId,
    action: "org.gateway.disconnected",
    entityType: "organization",
    entityId: session.orgId,
    ip: clientIp(),
  });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}
