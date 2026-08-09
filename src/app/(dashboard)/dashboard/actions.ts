"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrgUser, requireOrgAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { adminDb } from "@/lib/db";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { queueReceiptEmail, flushEmails } from "@/lib/notifications";
import { emailLayout, escapeHtml } from "@/lib/email";
import { unusablePasswordHash, sendInvite } from "@/lib/auth/invite";
import { revokeSessions } from "@/lib/auth/revocation";
import { loadConsentedDonors, filterSegment } from "@/lib/segments";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { assertBillingActive } from "@/lib/access";

export type ActionState = { error?: string; ok?: boolean };

// ---------------- team / staff management (org_admin only) ----------------
export type TeamState = {
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

  // Disabling must take effect immediately — this account can read donor PII.
  if (status === "disabled") await revokeSessions("org", userId);
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

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
  primaryColor: z
    .string()
    .regex(/^#?[0-9a-fA-F]{6}$/, "Use a 6-digit hex color like #4f46e5")
    .optional()
    .or(z.literal("")),
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
    primaryColor: formData.get("primaryColor") || undefined,
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

  const color = parsed.data.primaryColor
    ? parsed.data.primaryColor.startsWith("#")
      ? parsed.data.primaryColor
      : `#${parsed.data.primaryColor}`
    : null;

  await withTenant(session.orgId, (tx) =>
    tx.organization.update({
      where: { id: session.orgId },
      data: {
        name: parsed.data.name,
        charityStatus: parsed.data.charityStatus,
        craRegistrationNumber: parsed.data.craRegistrationNumber,
        authorizedSignatory: parsed.data.authorizedSignatory,
        receiptLocality: parsed.data.receiptLocality,
        primaryColor: color,
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

export async function setPledgeStatus(pledgeId: string, status: "open" | "fulfilled" | "cancelled") {
  const session = await requireOrgUser();
  await withTenant(session.orgId, async (tx) => {
    const p = await tx.pledge.findFirst({ where: { id: pledgeId } });
    if (p) await tx.pledge.update({ where: { id: pledgeId }, data: { status } });
  });
  revalidatePath("/dashboard/pledges");
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;
  if (d.advantage >= d.price) return { error: "Advantage must be less than price." };
  await withTenant(session.orgId, async (tx) => {
    const ev = await tx.event.findFirst({ where: { id: d.eventId } });
    if (!ev) return;
    await tx.ticketType.create({
      data: { orgId: session.orgId, eventId: d.eventId, name: d.name, price: d.price, advantageValue: d.advantage },
    });
  });
  revalidatePath(`/dashboard/events/${d.eventId}`);
  return { ok: true };
}

export async function setEventStatus(eventId: string, status: "published" | "closed") {
  const session = await requireOrgUser();
  await withTenant(session.orgId, async (tx) => {
    const ev = await tx.event.findFirst({ where: { id: eventId } });
    if (ev) await tx.event.update({ where: { id: eventId }, data: { status } });
  });
  revalidatePath(`/dashboard/events/${eventId}`);
  revalidatePath("/dashboard/events");
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

export async function setMembershipPlanActive(planId: string, isActive: boolean) {
  const session = await requireOrgUser();
  await withTenant(session.orgId, async (tx) => {
    const p = await tx.membershipPlan.findFirst({ where: { id: planId } });
    if (p) await tx.membershipPlan.update({ where: { id: planId }, data: { isActive } });
  });
  revalidatePath("/dashboard/memberships");
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

export async function setCampaignStatus(campaignId: string, status: "active" | "closed") {
  const session = await requireOrgUser();
  await withTenant(session.orgId, async (tx) => {
    const c = await tx.campaign.findFirst({ where: { id: campaignId } });
    if (!c) return;
    await tx.campaign.update({ where: { id: campaignId }, data: { status } });
  });
  revalidatePath("/dashboard/campaigns");
  revalidatePath(`/dashboard/campaigns/${campaignId}`);
}

// ---------------- communications campaign (CASL-gated) ----------------
export type CampaignState = { error?: string; ok?: boolean; sent?: number; capped?: boolean };

const RECIPIENT_CAP = 200; // bound a single send (queue/batch for larger lists)

const emailCampaignSchema = z.object({
  segment: z.enum(["all", "recurring", "high_value", "lapsed"]),
  subject: z.string().min(3, "Add a subject").max(200),
  message: z.string().min(5, "Write a message").max(10000),
});

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

  // resolve consented recipients for the segment
  const { orgName, brandColor, logoUrl, recipients } = await withTenant(session.orgId, async (tx) => {
    const org = await tx.organization.findUnique({ where: { id: session.orgId } });
    const donors = await loadConsentedDonors(tx);
    return {
      orgName: org?.name ?? "your organization",
      brandColor: org?.primaryColor ?? null,
      logoUrl: org?.logoUrl ?? null,
      recipients: filterSegment(donors, segment),
    };
  });

  const capped = recipients.length > RECIPIENT_CAP;
  const batch = recipients.slice(0, RECIPIENT_CAP);
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/portal/profile`;

  // Queue every recipient FIRST, in one write, then deliver.
  //
  // The original shape sent up to 200 emails sequentially with nothing recorded,
  // so a killed request re-sent to everyone on retry. Queued rows make the
  // outcome visible per recipient.
  //
  // The re-read below MUST be scoped to this send. An earlier version matched
  // `status: "queued"` across the whole org, which swept up stale rows left by
  // any previously-killed campaign: one could be marked `sent` while carrying a
  // different campaign's subject, and its sibling stranded `queued` forever,
  // permanently inflating the delivery-failure count. `sendId` correlates the
  // rows to this send and nothing else.
  const sendId = randomUUID();
  const queued = await withTenant(session.orgId, async (tx) => {
    await tx.notification.createMany({
      data: batch.map((r) => ({
        orgId: session.orgId,
        donorId: r.id,
        channel: "email" as const,
        category: "marketing",
        status: "queued" as const,
        caslChecked: true,
        payload: { subject, segment, sendId },
      })),
    });
    return tx.notification.findMany({
      where: {
        orgId: session.orgId,
        category: "marketing",
        status: "queued",
        payload: { path: ["sendId"], equals: sendId },
      },
      select: { id: true, donorId: true },
    });
  });

  const byDonor = new Map(queued.filter((q) => q.donorId).map((q) => [q.donorId as string, q.id]));
  const messages = batch
    .filter((r) => byDonor.has(r.id))
    .map((r) => ({
      notificationId: byDonor.get(r.id) as string,
      orgId: session.orgId,
      to: r.email,
      subject,
      html: emailLayout({
        heading: escapeHtml(subject),
        body:
          `${escapeHtml(message).replace(/\n/g, "<br/>")}` +
          `<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0"/>` +
          `<p style="font-size:12px;color:#94a3b8">You're receiving this from ${escapeHtml(orgName)} ` +
          `because you opted in to updates. <a href="${portalUrl}">Manage your preferences</a> to unsubscribe.</p>`,
        brand: { orgName, brandColor, logoUrl },
      }),
    }));

  await flushEmails(messages);

  const sent = await withTenant(session.orgId, (tx) =>
    tx.notification.count({
      where: { id: { in: messages.map((m) => m.notificationId) }, status: "sent" },
    })
  );

  revalidatePath("/dashboard/communications");
  return { ok: true, sent, capped };
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

  await withTenant(session.orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: d.donorId } });
    if (!donor) return;
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
  });
  revalidatePath(`/dashboard/donors/${d.donorId}`);
  revalidatePath("/dashboard/donors");
  return { ok: true };
}

// ---------------- org-side recurring plan controls ----------------
export async function orgUpdatePlanStatus(
  planId: string,
  action: "pause" | "resume" | "cancel"
) {
  const session = await requireOrgUser();
  const status = action === "pause" ? "paused" : action === "resume" ? "active" : "cancelled";
  await withTenant(session.orgId, async (tx) => {
    const plan = await tx.recurringPlan.findFirst({ where: { id: planId } });
    if (!plan) return;
    await tx.recurringPlan.update({
      where: { id: planId },
      data: { status, cancelledAt: action === "cancel" ? new Date() : null },
    });
  });
  revalidatePath("/dashboard/recurring");
  revalidatePath("/dashboard");
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
