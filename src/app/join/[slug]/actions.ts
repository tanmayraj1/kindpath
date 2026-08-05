"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { queueReceiptEmail, flushEmails } from "@/lib/notifications";
import { verifyChargeToken } from "@/lib/charge-token";
import { signReceiptToken } from "@/lib/receipt-links";
import { formErrors, type FieldErrors } from "@/lib/validation";

const FREQ_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90, annual: 365 };

export type MembershipState = { error?: string; fields?: FieldErrors };

const schema = z.object({
  slug: z.string().min(1),
  chargeRef: z.string().min(1),
  planId: z.string().min(1),
  firstName: z.string().min(1, "First name is required").max(100),
  middleInitial: z.string().max(2).optional(),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email").max(254),
  addressLine1: z.string().min(2, "Address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  province: z.string().min(1, "Province is required").max(50),
  postalCode: z.string().min(3, "Postal code is required").max(12),
});

export async function completeMembership(
  _prev: MembershipState,
  formData: FormData
): Promise<MembershipState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const { fields, message } = formErrors(parsed.error);
    return { error: message, fields };
  }
  const d = parsed.data;

  const org = await adminDb.organization.findUnique({ where: { slug: d.slug } });
  if (!org) return { error: "Organization not found." };

  const charge = verifyChargeToken(d.chargeRef);
  if (!charge || charge.orgId !== org.id) {
    return { error: "Your payment session expired. Please start again." };
  }
  const amount = charge.amount;
  const year = new Date().getFullYear();

  const { receiptId, mail } = await withTenant(org.id, async (tx) => {
    const plan = await tx.membershipPlan.findFirst({ where: { id: d.planId } });
    if (!plan) throw new Error("Plan not found");

    const existing = await tx.donation.findFirst({
      where: { chargeKey: charge.ref },
      include: { receipt: true },
    });
    if (existing?.receipt) return { receiptId: existing.receipt.id, mail: null };

    const donor = await tx.donor.upsert({
      where: { orgId_email: { orgId: org.id, email: d.email } },
      create: {
        orgId: org.id,
        firstName: d.firstName,
        middleInitial: d.middleInitial,
        lastName: d.lastName,
        email: d.email,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode: d.postalCode,
        addressStatus: "complete",
        caslConsent: "implied",
        caslConsentAt: new Date(),
        caslConsentSource: "membership",
      },
      update: {
        firstName: d.firstName,
        lastName: d.lastName,
        addressLine1: d.addressLine1,
        city: d.city,
        province: d.province,
        postalCode: d.postalCode,
        addressStatus: "complete",
      },
    });

    const pm = await tx.donorPaymentMethod.create({
      data: {
        orgId: org.id,
        donorId: donor.id,
        providerToken: `tok_${charge.ref}`,
        brand: charge.brand ?? null,
        last4: charge.last4 ?? null,
        isDefault: true,
      },
    });
    const recurring = await tx.recurringPlan.create({
      data: {
        orgId: org.id,
        donorId: donor.id,
        membershipPlanId: plan.id,
        paymentMethodId: pm.id,
        amount,
        frequency: plan.frequency,
        status: "active",
        nextBillingDate: new Date(Date.now() + (FREQ_DAYS[plan.frequency] ?? 365) * 86400000),
      },
    });
    const donation = await tx.donation.create({
      data: {
        orgId: org.id,
        donorId: donor.id,
        recurringPlanId: recurring.id,
        type: "recurring",
        amount,
        advantageValue: 0,
        eligibleAmount: amount,
        status: "succeeded",
        providerChargeRef: charge.ref,
        chargeKey: charge.ref,
        receivedAt: new Date(),
      },
    });

    // membership dues are issued as a payment confirmation (not a pure gift)
    const serial = await nextReceiptSerial(tx, org.id, year, org.receiptPrefix);
    const receipt = await tx.receipt.create({
      data: {
        orgId: org.id,
        donationId: donation.id,
        donorId: donor.id,
        serialNumber: serial,
        documentType: "confirmation",
        donorNameSnapshot: [d.firstName, d.middleInitial, d.lastName].filter(Boolean).join(" "),
        donorAddressSnapshot: formatAddress({ ...d, country: "CA" }),
        orgNameSnapshot: org.name,
        amount,
        advantageValue: 0,
        eligibleAmount: amount,
        placeIssued: org.receiptLocality,
        dateDonationReceived: donation.receivedAt,
        year,
      },
    });

    const mail = await queueReceiptEmail(tx, {
      orgId: org.id,
      donorId: donor.id,
      donorEmail: d.email,
      donorName: `${d.firstName} ${d.lastName}`,
      orgName: org.name,
      receiptId: receipt.id,
      serialNumber: receipt.serialNumber,
      eligibleAmount: amount,
      official: false,
      brandColor: org.primaryColor,
      logoUrl: org.logoUrl,
    });
    return { receiptId: receipt.id, mail };
  });

  if (mail) await flushEmails([mail]);
  redirect(`/r/${receiptId}?t=${signReceiptToken(receiptId)}`);
}
