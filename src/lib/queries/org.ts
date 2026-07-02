import { withTenant } from "@/lib/tenant";

/** Org row (own tenant). */
export function getOrg(orgId: string) {
  return withTenant(orgId, (tx) => tx.organization.findUnique({ where: { id: orgId } }));
}

/** Donor list with aggregate giving + recurring status. */
export function listDonors(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const donors = await tx.donor.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        donations: { where: { status: "succeeded" }, select: { amount: true } },
        recurringPlans: { where: { status: "active" }, select: { id: true } },
      },
    });
    return donors.map((d) => ({
      id: d.id,
      name: `${d.firstName} ${d.lastName}`,
      email: d.email,
      addressComplete: d.addressStatus === "complete",
      casl: d.caslConsent,
      recurring: d.recurringPlans.length > 0,
      totalGiven: d.donations.reduce((s, x) => s + Number(x.amount), 0),
    }));
  });
}

/** Recurring plans with donor + fund names. */
export function listRecurringPlans(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const plans = await tx.recurringPlan.findMany({
      orderBy: { startedAt: "desc" },
      include: { donor: true, fund: true },
    });
    return plans.map((p) => ({
      id: p.id,
      donor: `${p.donor.firstName} ${p.donor.lastName}`,
      fund: p.fund?.name ?? "—",
      amount: Number(p.amount),
      frequency: p.frequency,
      status: p.status,
      nextBillingDate: p.nextBillingDate,
    }));
  });
}

/** Funds with simple usage counts. */
export function listFunds(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const funds = await tx.fund.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { donations: true } } },
    });
    return funds.map((f) => ({
      id: f.id,
      name: f.name,
      code: f.code,
      isActive: f.isActive,
      donationCount: f._count.donations,
    }));
  });
}

/** Org team members (staff with portal access). */
export function listTeamMembers(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const users = await tx.orgUser.findMany({ orderBy: { createdAt: "asc" } });
    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      lastLoginAt: u.lastLoginAt,
    }));
  });
}

/** Full profile for one donor within the org. */
export function getOrgDonorDetail(orgId: string, donorId: string) {
  return withTenant(orgId, async (tx) => {
    const donor = await tx.donor.findFirst({ where: { id: donorId } });
    if (!donor) return null;
    const [donations, plans, receipts, agg] = await Promise.all([
      tx.donation.findMany({
        where: { donorId },
        orderBy: { receivedAt: "desc" },
        include: { fund: true, receipt: true },
      }),
      tx.recurringPlan.findMany({ where: { donorId }, include: { fund: true } }),
      tx.receipt.findMany({ where: { donorId }, orderBy: { dateIssued: "desc" } }),
      tx.donation.aggregate({
        _sum: { eligibleAmount: true },
        where: { donorId, status: "succeeded" },
      }),
    ]);
    return {
      donor: {
        id: donor.id,
        name: `${donor.firstName} ${donor.lastName}`,
        firstName: donor.firstName,
        lastName: donor.lastName,
        email: donor.email,
        phone: donor.phone,
        addressLine1: donor.addressLine1,
        city: donor.city,
        province: donor.province,
        postalCode: donor.postalCode,
        notes: donor.notes,
        emailMarketingOptIn: donor.emailMarketingOptIn,
        smsMarketingOptIn: donor.smsMarketingOptIn,
        address: [donor.addressLine1, donor.city, donor.province, donor.postalCode]
          .filter(Boolean)
          .join(", "),
        addressComplete: donor.addressStatus === "complete",
        casl: donor.caslConsent,
      },
      totalGiven: Number(agg._sum.eligibleAmount ?? 0),
      donations: donations.map((d) => ({
        id: d.id,
        fund: d.fund?.name ?? "—",
        amount: Number(d.amount),
        status: d.status,
        date: d.receivedAt,
        receiptId: d.receipt?.id ?? null,
      })),
      activePlans: plans.filter((p) => p.status === "active").length,
      receiptsCount: receipts.length,
    };
  });
}

/** Issued/voided receipts with donor name. */
export function listReceipts(orgId: string) {
  return withTenant(orgId, async (tx) => {
    const receipts = await tx.receipt.findMany({
      orderBy: { dateIssued: "desc" },
      include: { donor: true },
    });
    return receipts.map((r) => ({
      id: r.id,
      serialNumber: r.serialNumber,
      donor: `${r.donor.firstName} ${r.donor.lastName}`,
      type: r.documentType,
      amount: Number(r.amount),
      eligibleAmount: Number(r.eligibleAmount),
      status: r.status,
      dateIssued: r.dateIssued,
    }));
  });
}
