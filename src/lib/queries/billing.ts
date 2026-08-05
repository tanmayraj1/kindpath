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
  const orgs = await adminDb.organization.findMany({
    include: { subscription: true, subscriptionInvoices: { orderBy: { issuedAt: "desc" } } },
    orderBy: { name: "asc" },
  });

  return orgs.map((o) => {
    const invoices = o.subscriptionInvoices;
    const outstanding = invoices
      .filter((i) => i.status !== "paid" && i.status !== "void")
      .reduce((s, i) => s + Number(i.total), 0);
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
      invoiceCount: invoices.length,
      outstanding,
      lastInvoice: invoices[0]
        ? {
            id: invoices[0].id,
            invoiceNumber: invoices[0].invoiceNumber,
            total: Number(invoices[0].total),
            status: invoices[0].status,
            issuedAt: invoices[0].issuedAt,
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
