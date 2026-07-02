/**
 * Seed script. Connects as the SUPERUSER (ADMIN_DATABASE_URL) so it can insert
 * across tenants freely (bypasses RLS). Run with: npm run db:seed
 */
import { PrismaClient, type CharityStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasourceUrl: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL,
});

const PW = "Password123!";
const YEAR = new Date().getFullYear();

function daysAgo(n: number) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

async function main() {
  console.log("⏳ Resetting data…");
  // order respects FKs (cascades handle most, but be explicit)
  await prisma.receipt.deleteMany();
  await prisma.donation.deleteMany();
  await prisma.recurringPlan.deleteMany();
  await prisma.donorPaymentMethod.deleteMany();
  await prisma.donor.deleteMany();
  await prisma.receiptSequence.deleteMany();
  await prisma.fund.deleteMany();
  await prisma.subscriptionInvoice.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.volunteerPass.deleteMany();
  await prisma.volunteer.deleteMany();
  await prisma.orgUser.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.platformAdmin.deleteMany();

  const hash = await bcrypt.hash(PW, 12);

  // ---------- platform admin ----------
  await prisma.platformAdmin.create({
    data: {
      email: "admin@kindpath.app",
      name: "Platform Admin",
      role: "super_admin",
      passwordHash: hash,
    },
  });

  // ---------- registered charity ----------
  await seedOrg({
    hash,
    name: "St. Mary's Parish",
    slug: "st-marys",
    charityStatus: "registered",
    cra: "118912345 RR 0001",
    adminEmail: "jane@stmarys.org",
    adminName: "Jane Doe",
    plan: "community",
    fundNames: ["General Fund", "Building Fund", "Missions", "Youth"],
    donors: [
      { first: "Aanya", last: "Sharma", email: "aanya@example.com", withLogin: true },
      { first: "Michael", last: "Chen", email: "michael@example.com" },
      { first: "David", last: "Okafor", email: "david@example.com" },
      { first: "Sarah", last: "Thompson", email: "sarah@example.com" },
      { first: "Liam", last: "Murphy", email: "liam@example.com" },
      { first: "Priya", last: "Patel", email: "priya@example.com" },
    ],
  });

  // ---------- demo volunteer + pass (St. Mary's) ----------
  const stMarys = await prisma.organization.findUnique({ where: { slug: "st-marys" } });
  if (stMarys) {
    const volunteer = await prisma.volunteer.create({
      data: {
        orgId: stMarys.id,
        firstName: "Grace",
        lastName: "Lee",
        email: "grace@example.com",
        role: "Usher",
        passwordHash: hash,
      },
    });
    await prisma.volunteerPass.create({
      data: {
        orgId: stMarys.id,
        volunteerId: volunteer.id,
        title: "Sunday Service Access 2026",
        serial: "VP-2026-DEMO0001",
        validFrom: new Date(),
        validUntil: new Date(new Date().getFullYear(), 11, 31),
      },
    });
  }

  // ---------- non-registered org ----------
  await seedOrg({
    hash,
    name: "Riverside Community Mosque",
    slug: "riverside",
    charityStatus: "non_registered",
    cra: null,
    adminEmail: "admin@riverside.org",
    adminName: "Yusuf Khan",
    plan: "starter",
    fundNames: ["Zakat", "Sadaqah", "General", "Building"],
    donors: [
      { first: "Fatima", last: "Al-Rashid", email: "fatima@example.com" },
      { first: "Omar", last: "Hassan", email: "omar@example.com" },
      { first: "Amina", last: "Diallo", email: "amina@example.com" },
    ],
  });

  console.log("\n✅ Seed complete.\n");
  console.log("Login credentials (password for all: " + PW + ")");
  console.log("  Platform admin : admin@kindpath.app   → /admin");
  console.log("  Org admin (reg): jane@stmarys.org      → /dashboard");
  console.log("  Org admin (non): admin@riverside.org   → /dashboard");
  console.log("  Donor          : aanya@example.com     → /portal");
  console.log("  Volunteer      : grace@example.com     → /volunteer");
}

async function seedOrg(opts: {
  hash: string;
  name: string;
  slug: string;
  charityStatus: CharityStatus;
  cra: string | null;
  adminEmail: string;
  adminName: string;
  plan: "starter" | "community";
  fundNames: string[];
  donors: { first: string; last: string; email: string; withLogin?: boolean }[];
}) {
  const registered = opts.charityStatus === "registered";

  const org = await prisma.organization.create({
    data: {
      name: opts.name,
      slug: opts.slug,
      charityStatus: opts.charityStatus,
      craRegistrationNumber: opts.cra ?? undefined,
      authorizedSignatory: registered ? "Rev. Thomas Allen" : undefined,
      receiptLocality: "Toronto, ON",
      receiptMode: "both",
      onboardedAt: new Date(),
      addressLine1: "123 Faith Street",
      city: "Toronto",
      province: "ON",
      postalCode: "M5V 2T6",
      users: {
        create: {
          email: opts.adminEmail,
          name: opts.adminName,
          role: "org_admin",
          passwordHash: opts.hash,
        },
      },
      subscription: {
        create: {
          plan: opts.plan,
          cycle: "monthly",
          priceCad: opts.plan === "community" ? 59 : 29,
          status: registered ? "active" : "trialing",
          trialEndsAt: registered ? undefined : daysAgo(-10),
          currentPeriodStart: registered ? daysAgo(20) : undefined,
          currentPeriodEnd: registered ? daysAgo(-10) : undefined,
          nextBillingDate: registered ? daysAgo(-10) : undefined,
        },
      },
      funds: { create: opts.fundNames.map((name) => ({ name })) },
    },
    include: { funds: true },
  });

  // donors (+ optional self-service login + a payment method)
  const donors = [];
  for (const d of opts.donors) {
    const donor = await prisma.donor.create({
      data: {
        orgId: org.id,
        firstName: d.first,
        lastName: d.last,
        email: d.email,
        addressLine1: "456 Donor Ave",
        city: "Toronto",
        province: "ON",
        postalCode: "M4B 1B3",
        addressStatus: "complete",
        caslConsent: "express",
        caslConsentAt: daysAgo(30),
        emailMarketingOptIn: true,
        passwordHash: d.withLogin ? opts.hash : undefined,
        paymentMethods: {
          create: {
            orgId: org.id,
            providerToken: `tok_seed_${d.email}`,
            brand: "Visa",
            last4: "4242",
            expMonth: 12,
            expYear: 2030,
            isDefault: true,
          },
        },
      },
      include: { paymentMethods: true },
    });
    donors.push(donor);
  }

  // recurring plans for first two donors
  for (let i = 0; i < Math.min(2, donors.length); i++) {
    const donor = donors[i];
    await prisma.recurringPlan.create({
      data: {
        orgId: org.id,
        donorId: donor.id,
        fundId: org.funds[i % org.funds.length].id,
        paymentMethodId: donor.paymentMethods[0]?.id,
        amount: i === 0 ? 250 : 75,
        frequency: "monthly",
        status: "active",
        nextBillingDate: daysAgo(-7),
        providerRecurringRef: `sub_seed_${donor.id.slice(0, 8)}`,
      },
    });
  }

  // donations + receipts
  let serial = 0;
  const amounts = [250, 1000, 75, 50, 500, 120, 300, 80, 45, 200, 60, 150];
  const types: ("one_time" | "recurring")[] = ["recurring", "one_time"];
  for (let i = 0; i < amounts.length; i++) {
    const donor = donors[i % donors.length];
    const fund = org.funds[i % org.funds.length];
    const amount = amounts[i];
    // make one donation fail, and one have an advantage (event ticket)
    const failed = i === 3;
    const advantage = i === 4 ? 50 : 0; // $50 gala dinner advantage
    const eligible = amount - advantage;
    const status = failed ? "failed" : "succeeded";

    const donation = await prisma.donation.create({
      data: {
        orgId: org.id,
        donorId: donor.id,
        fundId: fund.id,
        type: types[i % 2],
        amount,
        advantageValue: advantage,
        advantageDescription: advantage ? "Gala dinner ticket" : undefined,
        eligibleAmount: eligible,
        status,
        receivedAt: daysAgo(i + 1),
        providerChargeRef: `ch_seed_${i}`,
      },
    });

    if (status === "succeeded") {
      serial += 1;
      const serialNumber = `${YEAR}-${String(serial).padStart(6, "0")}`;
      await prisma.receipt.create({
        data: {
          orgId: org.id,
          donationId: donation.id,
          donorId: donor.id,
          serialNumber,
          documentType: registered ? "official" : "confirmation",
          donorNameSnapshot: `${donor.firstName} ${donor.lastName}`,
          donorAddressSnapshot: "456 Donor Ave, Toronto, ON M4B 1B3",
          orgNameSnapshot: org.name,
          orgRegNumberSnapshot: opts.cra ?? undefined,
          amount,
          advantageValue: advantage,
          eligibleAmount: eligible,
          placeIssued: "Toronto, ON",
          dateDonationReceived: donation.receivedAt,
          signatoryNameSnapshot: registered ? "Rev. Thomas Allen" : undefined,
          year: YEAR,
        },
      });
    }
  }

  await prisma.receiptSequence.create({
    data: { orgId: org.id, year: YEAR, lastNumber: serial },
  });

  console.log(`  • ${org.name} (${opts.charityStatus}) — ${donors.length} donors, ${serial} receipts`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
