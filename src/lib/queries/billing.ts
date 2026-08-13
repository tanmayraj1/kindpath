import { adminDb } from "@/lib/db";
import { computeInvoice } from "@/lib/tax";

/**
 * Subscription + invoice history for an org.
 *
 * Reads through adminDb rather than withTenant on purpose: this must still work
 * when the org's access is locked, because the invoice is exactly what they need
 * to see in order to fix it. The orgId comes from the authenticated session, so
 * scoping is enforced by the caller's guard, not by RLS.
 */
export type OrgBilling = {
  plan: string;
  cycle: string;
  priceCad: number;
  status: string;
  trialEndsAt: Date | null;
  nextBillingDate: Date | null;
  province: string | null;
  /** What the next invoice will look like, before it's issued. */
  preview: ReturnType<typeof computeInvoice>;
  invoices: {
    id: string;
    invoiceNumber: string;
    subtotal: number;
    taxAmount: number;
    total: number;
    status: string;
    issuedAt: Date;
  }[];
  outstandingTotal: number;
};

export async function getOrgBilling(orgId: string): Promise<OrgBilling | null> {
  const org = await adminDb.organization.findUnique({
    where: { id: orgId },
    include: { subscription: true },
  });
  if (!org?.subscription) return null;

  const rows = await adminDb.subscriptionInvoice.findMany({
    where: { orgId },
    orderBy: { issuedAt: "desc" },
    take: 24,
  });

  const invoices = rows.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    subtotal: Number(i.subtotal),
    taxAmount: Number(i.taxAmount),
    total: Number(i.total),
    status: i.status,
    issuedAt: i.issuedAt,
  }));

  return {
    plan: org.subscription.plan,
    cycle: org.subscription.cycle,
    priceCad: Number(org.subscription.priceCad),
    status: org.subscription.status,
    trialEndsAt: org.subscription.trialEndsAt,
    nextBillingDate: org.subscription.nextBillingDate,
    province: org.province,
    preview: computeInvoice(Number(org.subscription.priceCad), org.province),
    invoices,
    outstandingTotal: invoices
      .filter((i) => i.status !== "paid" && i.status !== "void")
      .reduce((sum, i) => sum + i.total, 0),
  };
}

/** Every org's billing position, for God Mode. */
export async function listPlatformBilling() {
  // Only the newest invoice per org is displayed, but this used to load EVERY
  // invoice ever issued to EVERY organization in order to show it — the one query
  // in God Mode that grows without bound as the platform succeeds. The count and
  // the outstanding balance are now aggregates, and only the newest row is read.
  const [orgs, totals, newest] = await Promise.all([
    adminDb.organization.findMany({ include: { subscription: true }, orderBy: { name: "asc" } }),
    adminDb.subscriptionInvoice.groupBy({
      by: ["orgId"],
      _count: { _all: true },
      _sum: { total: true },
    }),
    adminDb.$queryRaw<
      { org_id: string; id: string; invoice_number: string; total: number; status: string; issued_at: Date }[]
    >`
      SELECT DISTINCT ON (org_id)
             org_id, id, invoice_number, total::float8 AS total, status, issued_at
      FROM subscription_invoices
      ORDER BY org_id, issued_at DESC
    `,
  ]);

  // Outstanding excludes paid and void, so it needs its own scoped aggregate.
  const owedRows = await adminDb.subscriptionInvoice.groupBy({
    by: ["orgId"],
    _sum: { total: true },
    where: { status: { notIn: ["paid", "void"] } },
  });

  const countByOrg = new Map(totals.map((t) => [t.orgId, t._count._all]));
  const owedByOrg = new Map(owedRows.map((t) => [t.orgId, Number(t._sum.total ?? 0)]));
  const newestByOrg = new Map(newest.map((n) => [n.org_id, n]));

  return orgs.map((o) => {
    const last = newestByOrg.get(o.id);
    return {
      orgId: o.id,
      name: o.name,
      province: o.province,
      status: o.status,
      plan: o.subscription?.plan ?? null,
      cycle: o.subscription?.cycle ?? null,
      priceCad: o.subscription ? Number(o.subscription.priceCad) : 0,
      subscriptionStatus: o.subscription?.status ?? null,
      trialEndsAt: o.subscription?.trialEndsAt ?? null,
      invoiceCount: countByOrg.get(o.id) ?? 0,
      outstanding: owedByOrg.get(o.id) ?? 0,
      lastInvoice: last
        ? {
            id: last.id,
            invoiceNumber: last.invoice_number,
            total: Number(last.total),
            status: last.status,
            issuedAt: last.issued_at,
          }
        : null,
    };
  });
}

/** Monthly recurring revenue across active + past-due subscriptions. */
export function mrrOf(rows: { priceCad: number; cycle: string | null; subscriptionStatus: string | null }[]) {
  return rows
    .filter((r) => r.subscriptionStatus === "active" || r.subscriptionStatus === "past_due")
    .reduce((sum, r) => sum + (r.cycle === "annual" ? r.priceCad / 12 : r.priceCad), 0);
}
