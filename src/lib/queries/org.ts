import type { Prisma } from "@prisma/client";
import { withTenant } from "@/lib/tenant";
import { paged, type PageParams, type Paged } from "@/lib/pagination";

/** Org row (own tenant). */
export function getOrg(orgId: string) {
  return withTenant(orgId, (tx) => tx.organization.findUnique({ where: { id: orgId } }));
}

export type DonorRow = {
  id: string;
  name: string;
  email: string;
  addressComplete: boolean;
  casl: string;
  recurring: boolean;
  totalGiven: number;
};

/**
 * Donor list with aggregate giving + recurring status, paginated and searchable.
 *
 * Totals come from a groupBy over the page's donors rather than by including
 * every donation row: the previous version loaded the whole donor table plus
 * every donation attached to it, then summed in JavaScript.
 */
export function listDonors(orgId: string, p: PageParams): Promise<Paged<DonorRow>> {
  return withTenant(orgId, async (tx) => {
    const where = p.q
      ? {
          OR: [
            { firstName: { contains: p.q, mode: "insensitive" as const } },
            { lastName: { contains: p.q, mode: "insensitive" as const } },
            { email: { contains: p.q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const [total, donors] = await Promise.all([
      tx.donor.count({ where }),
      tx.donor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: p.skip,
        take: p.size,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          addressStatus: true,
          caslConsent: true,
        },
      }),
    ]);

    const ids = donors.map((d) => d.id);
    const [sums, activePlans] = ids.length
      ? await Promise.all([
          tx.donation.groupBy({
            by: ["donorId"],
            where: { donorId: { in: ids }, status: "succeeded" },
            _sum: { amount: true },
          }),
          tx.recurringPlan.findMany({
            where: { donorId: { in: ids }, status: "active" },
            select: { donorId: true },
          }),
        ])
      : [[], []];

    const totals = new Map(sums.map((r) => [r.donorId, Number(r._sum.amount ?? 0)]));
    const recurring = new Set(activePlans.map((r) => r.donorId));

    return paged(
      donors.map((d) => ({
        id: d.id,
        name: `${d.firstName} ${d.lastName}`,
        email: d.email,
        addressComplete: d.addressStatus === "complete",
        casl: d.caslConsent as string,
        recurring: recurring.has(d.id),
        totalGiven: totals.get(d.id) ?? 0,
      })),
      total,
      p
    );
  });
}

/** Recurring plans with donor + fund names, paginated and searchable by donor. */
export function listRecurringPlans(orgId: string, page?: PageParams) {
  return withTenant(orgId, async (tx) => {
    const q = page?.q ?? "";
    const where = q
      ? {
          donor: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } },
            ],
          },
        }
      : {};
    const [total, plans] = await Promise.all([
      tx.recurringPlan.count({ where }),
      tx.recurringPlan.findMany({
        where,
        orderBy: { startedAt: "desc" },
        include: { donor: true, fund: true },
        ...(page ? { skip: page.skip, take: page.size } : {}),
      }),
    ]);
    const rows = plans.map((p) => ({
      id: p.id,
      donor: `${p.donor.firstName} ${p.donor.lastName}`,
      fund: p.fund?.name ?? "—",
      amount: Number(p.amount),
      frequency: p.frequency,
      status: p.status,
      nextBillingDate: p.nextBillingDate,
    }));
    return page ? paged(rows, total, page) : paged(rows, total, { page: 1, size: rows.length || 1, q: "", skip: 0 });
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
        anonymizedAt: donor.anonymizedAt,
        // Whether this donor can sign into the portal at all. Never the hash
        // itself — only whether one exists.
        hasPortalAccess: donor.passwordHash != null,
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

export type ReceiptFilters = { year?: string; status?: string; type?: string };

/**
 * Issued/voided receipts, paginated, searchable and filterable.
 *
 * The donor name comes from the receipt's own snapshot rather than a join to the
 * live donor row: a receipt must keep showing the name it was issued to, which is
 * what allows a donor to be erased while the charity retains valid CRA records.
 */
export function listReceipts(orgId: string, page?: PageParams, filters: ReceiptFilters = {}) {
  return withTenant(orgId, async (tx) => {
    const q = page?.q ?? "";
    const where: Prisma.ReceiptWhereInput = {
      ...(filters.year ? { year: Number(filters.year) } : {}),
      ...(filters.status ? { status: filters.status as Prisma.ReceiptWhereInput["status"] } : {}),
      ...(filters.type
        ? { documentType: filters.type as Prisma.ReceiptWhereInput["documentType"] }
        : {}),
      ...(q
        ? {
            OR: [
              { serialNumber: { contains: q, mode: "insensitive" as const } },
              { donorNameSnapshot: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const [total, receipts] = await Promise.all([
      tx.receipt.count({ where }),
      tx.receipt.findMany({
        where,
        orderBy: { dateIssued: "desc" },
        ...(page ? { skip: page.skip, take: page.size } : {}),
        select: {
          id: true,
          serialNumber: true,
          donorNameSnapshot: true,
          documentType: true,
          amount: true,
          eligibleAmount: true,
          status: true,
          dateIssued: true,
          year: true,
        },
      }),
    ]);

    const rows = receipts.map((r) => ({
      id: r.id,
      serialNumber: r.serialNumber,
      donor: r.donorNameSnapshot,
      type: r.documentType,
      amount: Number(r.amount),
      eligibleAmount: Number(r.eligibleAmount),
      status: r.status,
      dateIssued: r.dateIssued,
      year: r.year,
    }));
    return page
      ? paged(rows, total, page)
      : paged(rows, total, { page: 1, size: rows.length || 1, q: "", skip: 0 });
  });
}
