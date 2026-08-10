import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { audit } from "@/lib/audit";
import { revokeSessions } from "@/lib/auth/revocation";

/**
 * Donor data rights under PIPEDA and Quebec's Law 25.
 *
 * The hard part is that two obligations point in opposite directions: a donor may
 * demand erasure, and the Income Tax Act requires the charity to RETAIN the
 * records supporting every official donation receipt it issued. Deleting the
 * donor row would satisfy the first and breach the second — and until now the
 * schema would have cascaded straight through the receipts.
 *
 * The resolution, and the reason receipts snapshot donor name and address at
 * issue time: the receipt keeps what it said when it was issued, and the LIVING
 * donor record is scrubbed. Nothing is deleted; identifying data stops being
 * usable for contact, segmentation or marketing.
 */

// ---------------------------------------------------------------- export

export type DonorExport = {
  exportedAt: string;
  notice: string;
  donor: Record<string, unknown>;
  organization: { name: string; charityStatus: string };
  consentHistory: { status: string; recordedAt: string | null; source: string | null };
  donations: Record<string, unknown>[];
  receipts: Record<string, unknown>[];
  recurringPlans: Record<string, unknown>[];
  paymentMethods: Record<string, unknown>[];
  communications: Record<string, unknown>[];
};

/**
 * Everything one organization holds about one donor, in a portable form.
 *
 * Deliberately includes the derived records (receipts, communications) rather
 * than only the fields the donor typed: "access" under PIPEDA means what is held
 * about them, not what they supplied.
 */
export async function buildDonorExport(orgId: string, donorId: string): Promise<DonorExport | null> {
  return withTenant(orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: donorId } });
    if (!donor) return null;

    const org = await tx.organization.findUnique({ where: { id: orgId } });
    const [donations, receipts, plans, methods, notifications] = await Promise.all([
      tx.donation.findMany({
        where: { donorId },
        orderBy: { receivedAt: "desc" },
        include: { fund: { select: { name: true } } },
      }),
      tx.receipt.findMany({ where: { donorId }, orderBy: { dateIssued: "desc" } }),
      tx.recurringPlan.findMany({ where: { donorId }, orderBy: { startedAt: "desc" } }),
      tx.donorPaymentMethod.findMany({ where: { donorId } }),
      tx.notification.findMany({
        where: { donorId },
        orderBy: { createdAt: "desc" },
        select: { category: true, channel: true, status: true, sentAt: true, createdAt: true, payload: true },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      notice:
        "This is everything " +
        (org?.name ?? "this organization") +
        " holds about you in KindPath. Receipt records are retained as the Income Tax Act requires, " +
        "even if you later ask to be removed from our records.",
      organization: { name: org?.name ?? "", charityStatus: org?.charityStatus ?? "" },
      donor: {
        firstName: donor.firstName,
        middleInitial: donor.middleInitial,
        lastName: donor.lastName,
        email: donor.email,
        phone: donor.phone,
        addressLine1: donor.addressLine1,
        addressLine2: donor.addressLine2,
        city: donor.city,
        province: donor.province,
        postalCode: donor.postalCode,
        country: donor.country,
        notes: donor.notes,
        createdAt: donor.createdAt.toISOString(),
        anonymizedAt: donor.anonymizedAt?.toISOString() ?? null,
      },
      consentHistory: {
        status: donor.caslConsent,
        recordedAt: donor.caslConsentAt?.toISOString() ?? null,
        source: donor.caslConsentSource,
      },
      donations: donations.map((d) => ({
        date: d.receivedAt.toISOString(),
        amount: Number(d.amount),
        eligibleAmount: Number(d.eligibleAmount),
        advantageValue: Number(d.advantageValue),
        currency: d.currency,
        type: d.type,
        status: d.status,
        fund: d.fund?.name ?? null,
      })),
      receipts: receipts.map((r) => ({
        serialNumber: r.serialNumber,
        documentType: r.documentType,
        status: r.status,
        amount: Number(r.amount),
        eligibleAmount: Number(r.eligibleAmount),
        dateIssued: r.dateIssued.toISOString(),
        year: r.year,
        replacesSerial: r.replacesSerial,
        voidReason: r.voidReason,
      })),
      recurringPlans: plans.map((p) => ({
        amount: Number(p.amount),
        frequency: p.frequency,
        status: p.status,
        startedAt: p.startedAt?.toISOString() ?? null,
        nextBillingDate: p.nextBillingDate?.toISOString() ?? null,
      })),
      // Never the gateway token — it can charge money.
      paymentMethods: methods.map((m) => ({
        brand: m.brand,
        last4: m.last4,
        status: m.status,
        isDefault: m.isDefault,
      })),
      communications: notifications.map((n) => ({
        category: n.category,
        channel: n.channel,
        status: n.status,
        subject: (n.payload as { subject?: string } | null)?.subject ?? null,
        sentAt: n.sentAt?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  });
}

// ---------------------------------------------------------------- erasure

export type AnonymizeResult =
  | { ok: true; receiptsRetained: number; donationsRetained: number }
  | { error: string };

/** Placeholder used for every scrubbed identifier, so the row stays valid. */
function redacted(donorId: string) {
  // Email is unique per org, so it needs to stay unique after scrubbing.
  return {
    firstName: "Removed",
    lastName: "at request",
    middleInitial: null,
    email: `removed+${donorId}@redacted.invalid`,
    phone: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    province: null,
    postalCode: null,
    notes: null,
    // Contactable state must be revoked along with the identifiers.
    emailMarketingOptIn: false,
    smsMarketingOptIn: false,
    caslConsent: "none" as const,
    caslConsentSource: "erasure_request",
    addressStatus: "pending" as const,
    // Sign-in must stop working; the row is no longer a person's account.
    passwordHash: null,
    googleId: null,
  };
}

/**
 * Scrub a donor's identifying data while retaining the financial record.
 *
 * NOT a delete. Donations and receipts keep pointing at this row (the foreign
 * keys are RESTRICT precisely so nobody can delete around this), and the receipt
 * snapshots keep what each receipt said when issued — that is the record the CRA
 * requires, and it must remain intact for a charity's audit.
 */
export async function anonymizeDonor(args: {
  orgId: string;
  donorId: string;
  requestedBy: { type: "donor" | "org_user" | "platform_admin"; id: string };
  ip?: string;
}): Promise<AnonymizeResult> {
  const { orgId, donorId } = args;

  const counts = await withTenant(orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: donorId } });
    if (!donor) return null;
    if (donor.anonymizedAt) return { already: true, receipts: 0, donations: 0 };

    const [receipts, donations] = await Promise.all([
      tx.receipt.count({ where: { donorId } }),
      tx.donation.count({ where: { donorId } }),
    ]);

    await tx.donor.update({
      where: { id: donorId },
      data: { ...redacted(donorId), anonymizedAt: new Date() },
    });

    // Stop any future money movement in this donor's name.
    await tx.recurringPlan.updateMany({
      where: { donorId, status: { in: ["active", "paused"] } },
      data: { status: "cancelled", cancelledAt: new Date() },
    });
    await tx.donorPaymentMethod.updateMany({ where: { donorId }, data: { status: "removed" } });

    return { already: false, receipts, donations };
  });

  if (!counts) return { error: "That donor record no longer exists." };
  if (counts.already) return { error: "That donor record has already been anonymized." };

  // Any live session belongs to an identity that no longer exists.
  await revokeSessions("donor", donorId);

  await audit({
    actor: { type: args.requestedBy.type, id: args.requestedBy.id },
    orgId,
    action: "donor.anonymized",
    entityType: "donor",
    entityId: donorId,
    after: { receiptsRetained: counts.receipts, donationsRetained: counts.donations },
    ip: args.ip,
  });

  return { ok: true, receiptsRetained: counts.receipts, donationsRetained: counts.donations };
}

/** Consent changes need a before/after trail — it's what proves CASL compliance. */
export async function auditConsentChange(args: {
  orgId: string;
  donorId: string;
  actor: { type: "donor" | "org_user"; id: string };
  before: { caslConsent: string; emailMarketingOptIn: boolean; smsMarketingOptIn: boolean };
  after: { caslConsent: string; emailMarketingOptIn: boolean; smsMarketingOptIn: boolean };
  ip?: string;
}): Promise<void> {
  const changed =
    args.before.caslConsent !== args.after.caslConsent ||
    args.before.emailMarketingOptIn !== args.after.emailMarketingOptIn ||
    args.before.smsMarketingOptIn !== args.after.smsMarketingOptIn;
  if (!changed) return;

  await audit({
    actor: args.actor,
    orgId: args.orgId,
    action: "donor.consent_changed",
    entityType: "donor",
    entityId: args.donorId,
    before: args.before,
    after: args.after,
    ip: args.ip,
  });
}

/**
 * Internals exposed for testing. The scrub payload decides what survives a
 * donor's erasure request and what doesn't, so it is asserted directly rather
 * than only through a database round-trip.
 */
export const __testing = { redacted };

/** Donors an org has anonymized — surfaced so the erasure log is inspectable. */
export async function countAnonymizedDonors(orgId: string): Promise<number> {
  return adminDb.donor.count({ where: { orgId, anonymizedAt: { not: null } } });
}
