import { withTenant } from "@/lib/tenant";

function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1);
}

export function getDonorOverview(orgId: string, donorId: string) {
  return withTenant(orgId, async (tx) => {
    const yearStart = startOfYear();
    const [org, donor, lifetime, thisYear, plans, recent] = await Promise.all([
      tx.organization.findUnique({ where: { id: orgId } }),
      tx.donor.findUnique({ where: { id: donorId } }),
      tx.donation.aggregate({
        _sum: { eligibleAmount: true },
        where: { donorId, status: "succeeded" },
      }),
      tx.donation.aggregate({
        _sum: { eligibleAmount: true },
        where: { donorId, status: "succeeded", receivedAt: { gte: yearStart } },
      }),
      tx.recurringPlan.findMany({
        where: { donorId, status: { in: ["active", "suspended"] } },
        include: { fund: true },
      }),
      tx.donation.findMany({
        where: { donorId },
        orderBy: { receivedAt: "desc" },
        take: 5,
        include: { fund: true, receipt: true },
      }),
    ]);
    // A plan needs attention when it's been suspended or has a pending retry.
    const attention = plans.filter(
      (p) => p.status === "suspended" || (p.status === "active" && p.retryCount > 0)
    ).length;
    return {
      orgName: org?.name ?? "your organization",
      registered: org?.charityStatus === "registered",
      donorName: donor ? `${donor.firstName} ${donor.lastName}` : "",
      lifetime: Number(lifetime._sum.eligibleAmount ?? 0),
      thisYear: Number(thisYear._sum.eligibleAmount ?? 0),
      activePlans: plans.filter((p) => p.status === "active").length,
      attentionPlans: attention,
      nextBilling: plans
        .filter((p) => p.status === "active")
        .map((p) => p.nextBillingDate)
        .filter(Boolean)
        .sort((a, b) => (a! > b! ? 1 : -1))[0] ?? null,
      recent: recent.map((d) => ({
        id: d.id,
        fund: d.fund?.name ?? "—",
        amount: Number(d.amount),
        status: d.status,
        date: d.receivedAt,
        receiptId: d.receipt?.id ?? null,
      })),
    };
  });
}

export function listDonorDonations(orgId: string, donorId: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx.donation.findMany({
      where: { donorId },
      orderBy: { receivedAt: "desc" },
      include: { fund: true, receipt: true },
    });
    return rows.map((d) => ({
      id: d.id,
      fund: d.fund?.name ?? "—",
      type: d.type,
      amount: Number(d.amount),
      eligible: Number(d.eligibleAmount),
      status: d.status,
      date: d.receivedAt,
      receiptId: d.receipt?.id ?? null,
    }));
  });
}

export function listDonorPlans(orgId: string, donorId: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx.recurringPlan.findMany({
      where: { donorId },
      orderBy: { startedAt: "desc" },
      include: { fund: true },
    });
    return rows.map((p) => ({
      id: p.id,
      fund: p.fund?.name ?? "—",
      amount: Number(p.amount),
      frequency: p.frequency,
      status: p.status,
      nextBillingDate: p.nextBillingDate,
      retryCount: p.retryCount,
      // "past due" = still active but a charge failed and a retry is pending.
      pastDue: p.status === "active" && p.retryCount > 0,
    }));
  });
}

export function listDonorPaymentMethods(orgId: string, donorId: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx.donorPaymentMethod.findMany({
      where: { donorId, status: { not: "removed" } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((m) => ({
      id: m.id,
      brand: m.brand,
      last4: m.last4,
      expMonth: m.expMonth,
      expYear: m.expYear,
      isDefault: m.isDefault,
    }));
  });
}

export function listDonorReceipts(orgId: string, donorId: string) {
  return withTenant(orgId, async (tx) => {
    const rows = await tx.receipt.findMany({
      where: { donorId },
      orderBy: { dateIssued: "desc" },
    });
    return rows.map((r) => ({
      id: r.id,
      serialNumber: r.serialNumber,
      type: r.documentType,
      eligible: Number(r.eligibleAmount),
      status: r.status,
      date: r.dateIssued,
      year: r.year,
    }));
  });
}

export function getDonorProfile(orgId: string, donorId: string) {
  return withTenant(orgId, (tx) => tx.donor.findUnique({ where: { id: donorId } }));
}
