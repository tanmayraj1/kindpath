"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { nextReceiptSerial, formatAddress } from "@/lib/receipts";
import { sendReceiptEmail } from "@/lib/notifications";
import { verifyChargeToken } from "@/lib/charge-token";
import { signReceiptToken } from "@/lib/receipt-links";

export type TicketState = { error?: string };

const schema = z.object({
  slug: z.string().min(1),
  chargeRef: z.string().min(1),
  eventId: z.string().min(1),
  ticketTypeId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(20),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Enter a valid email").max(254),
  addressLine1: z.string().min(2, "Address is required").max(200),
  city: z.string().min(1, "City is required").max(100),
  province: z.string().min(1, "Province is required").max(50),
  postalCode: z.string().min(3, "Postal code is required").max(12),
});

export async function completeTicketPurchase(
  _prev: TicketState,
  formData: FormData
): Promise<TicketState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check your details." };
  const d = parsed.data;

  const org = await adminDb.organization.findUnique({ where: { slug: d.slug } });
  if (!org) return { error: "Organization not found." };
  const charge = verifyChargeToken(d.chargeRef);
  if (!charge || charge.orgId !== org.id) return { error: "Your payment session expired. Please start again." };

  const amount = charge.amount; // price * quantity, fixed at authorize time
  const registered = org.charityStatus === "registered";
  const year = new Date().getFullYear();

  const receiptId = await withTenant(org.id, async (tx) => {
    const tt = await tx.ticketType.findFirst({ where: { id: d.ticketTypeId, eventId: d.eventId } });
    const ev = await tx.event.findFirst({ where: { id: d.eventId } });
    if (!tt || !ev) throw new Error("Event/ticket not found");

    const existing = await tx.donation.findFirst({ where: { providerChargeRef: charge.ref }, include: { receipt: true } });
    if (existing?.receipt) return existing.receipt.id;

    const advantage = Math.min(amount, Number(tt.advantageValue) * d.quantity);
    const eligible = Math.max(0, amount - advantage);

    const donor = await tx.donor.upsert({
      where: { orgId_email: { orgId: org.id, email: d.email } },
      create: {
        orgId: org.id, firstName: d.firstName, lastName: d.lastName, email: d.email,
        addressLine1: d.addressLine1, city: d.city, province: d.province, postalCode: d.postalCode,
        addressStatus: "complete", caslConsent: "implied", caslConsentAt: new Date(), caslConsentSource: "event",
      },
      update: {
        firstName: d.firstName, lastName: d.lastName, addressLine1: d.addressLine1, city: d.city,
        province: d.province, postalCode: d.postalCode, addressStatus: "complete",
      },
    });

    const donation = await tx.donation.create({
      data: {
        orgId: org.id, donorId: donor.id, eventId: d.eventId, type: "one_time",
        amount, advantageValue: advantage,
        advantageDescription: `${d.quantity}× ${tt.name} — ${ev.title}`,
        eligibleAmount: eligible, status: "succeeded", providerChargeRef: charge.ref, receivedAt: new Date(),
      },
    });

    const serial = await nextReceiptSerial(tx, org.id, year, org.receiptPrefix);
    const receipt = await tx.receipt.create({
      data: {
        orgId: org.id, donationId: donation.id, donorId: donor.id, serialNumber: serial,
        documentType: registered ? "official" : "confirmation",
        donorNameSnapshot: `${d.firstName} ${d.lastName}`,
        donorAddressSnapshot: formatAddress({ ...d, country: "CA" }),
        orgNameSnapshot: org.name, orgRegNumberSnapshot: org.craRegistrationNumber,
        amount, advantageValue: advantage, eligibleAmount: eligible,
        placeIssued: org.receiptLocality, dateDonationReceived: donation.receivedAt,
        signatoryNameSnapshot: registered ? org.authorizedSignatory : null, year,
      },
    });

    await sendReceiptEmail(tx, {
      orgId: org.id, donorId: donor.id, donorEmail: d.email, donorName: `${d.firstName} ${d.lastName}`,
      orgName: org.name, receiptId: receipt.id, serialNumber: receipt.serialNumber,
      eligibleAmount: eligible, official: registered, brandColor: org.primaryColor, logoUrl: org.logoUrl,
    });
    return receipt.id;
  });

  redirect(`/r/${receiptId}?t=${signReceiptToken(receiptId)}`);
}
