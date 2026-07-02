import { withTenant } from "@/lib/tenant";

/**
 * Tenant-scoped, READ-ONLY tools the assistant may use. Every query runs under
 * withTenant(orgId) so the assistant can never see another org's data, and there
 * are no mutating tools — it can search and summarize, not change or delete.
 */

function startOfMonth() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), 1);
}
function startOfYear() {
  return new Date(new Date().getFullYear(), 0, 1);
}

export const TOOLS = [
  {
    name: "search_donors",
    description: "Search donors/members by name or email. Returns up to 8 matches with lifetime giving.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Name or email fragment to search for" } },
      required: ["query"],
    },
  },
  {
    name: "org_stats",
    description: "Key numbers for this organization: donors, money raised this month/year, active recurring, receipts issued.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "find_receipts",
    description: "Find receipts/bills by serial number or donor name. Returns up to 8.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Receipt serial number or donor name" } },
      required: ["query"],
    },
  },
  {
    name: "lapsed_donors",
    description: "Donors who have not given in the last 6 months (good re-engagement targets).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "recent_donations",
    description: "The most recent donations with donor, amount, fund and status.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_draft_campaign",
    description:
      "Create a fundraising campaign as a DRAFT (not public/active until a human publishes it). Safe and reversible. Use when the user asks to draft/start/set up a campaign.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Campaign title" },
        goalAmount: { type: "number", description: "Fundraising goal in CAD" },
      },
      required: ["title", "goalAmount"],
    },
  },
  {
    name: "export_csv",
    description: "Return a download link for a CSV export of the org's donors, donations, or receipts.",
    input_schema: {
      type: "object",
      properties: { type: { type: "string", enum: ["donors", "donations", "receipts"] } },
      required: ["type"],
    },
  },
] as const;

export type ToolName = (typeof TOOLS)[number]["name"];

export async function runTool(orgId: string, name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "search_donors": {
      const q = String(input.query ?? "").trim();
      if (!q) return { error: "empty query" };
      return withTenant(orgId, async (tx) => {
        const donors = await tx.donor.findMany({
          where: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 8,
          include: { donations: { where: { status: "succeeded" }, select: { eligibleAmount: true } } },
        });
        return donors.map((d) => ({
          name: `${d.firstName} ${d.lastName}`,
          email: d.email,
          phone: d.phone ?? null,
          lifetimeGiving: d.donations.reduce((s, x) => s + Number(x.eligibleAmount), 0),
          addressOnFile: d.addressStatus === "complete",
        }));
      });
    }
    case "org_stats": {
      return withTenant(orgId, async (tx) => {
        const [donors, month, year, recurring, receipts, members] = await Promise.all([
          tx.donor.count(),
          tx.donation.aggregate({ _sum: { amount: true }, where: { status: "succeeded", receivedAt: { gte: startOfMonth() } } }),
          tx.donation.aggregate({ _sum: { amount: true }, where: { status: "succeeded", receivedAt: { gte: startOfYear() } } }),
          tx.recurringPlan.count({ where: { status: "active" } }),
          tx.receipt.count({ where: { status: "issued" } }),
          tx.recurringPlan.count({ where: { status: "active", membershipPlanId: { not: null } } }),
        ]);
        return {
          totalDonors: donors,
          raisedThisMonth: Number(month._sum.amount ?? 0),
          raisedThisYear: Number(year._sum.amount ?? 0),
          activeRecurringPlans: recurring,
          activeMembers: members,
          receiptsIssued: receipts,
        };
      });
    }
    case "find_receipts": {
      const q = String(input.query ?? "").trim();
      return withTenant(orgId, async (tx) => {
        const rows = await tx.receipt.findMany({
          where: {
            OR: [
              { serialNumber: { contains: q, mode: "insensitive" } },
              { donorNameSnapshot: { contains: q, mode: "insensitive" } },
            ],
          },
          orderBy: { dateIssued: "desc" },
          take: 8,
        });
        return rows.map((r) => ({
          serial: r.serialNumber,
          donor: r.donorNameSnapshot,
          type: r.documentType,
          eligibleAmount: Number(r.eligibleAmount),
          status: r.status,
          issued: r.dateIssued.toISOString().slice(0, 10),
        }));
      });
    }
    case "lapsed_donors": {
      return withTenant(orgId, async (tx) => {
        const cutoff = new Date(Date.now() - 182 * 86400000);
        const donors = await tx.donor.findMany({
          take: 50,
          include: { donations: { where: { status: "succeeded" }, select: { receivedAt: true } } },
        });
        return donors
          .map((d) => ({
            name: `${d.firstName} ${d.lastName}`,
            email: d.email,
            lastGift: d.donations.reduce<Date | null>((l, x) => (!l || x.receivedAt > l ? x.receivedAt : l), null),
          }))
          .filter((d) => !d.lastGift || d.lastGift < cutoff)
          .slice(0, 15)
          .map((d) => ({ name: d.name, email: d.email, lastGift: d.lastGift ? d.lastGift.toISOString().slice(0, 10) : "never" }));
      });
    }
    case "recent_donations": {
      return withTenant(orgId, async (tx) => {
        const rows = await tx.donation.findMany({
          orderBy: { receivedAt: "desc" },
          take: 8,
          include: { donor: true, fund: true },
        });
        return rows.map((d) => ({
          donor: `${d.donor.firstName} ${d.donor.lastName}`,
          amount: Number(d.amount),
          fund: d.fund?.name ?? null,
          status: d.status,
          date: d.receivedAt.toISOString().slice(0, 10),
        }));
      });
    }
    case "create_draft_campaign": {
      const title = String(input.title ?? "").trim();
      const goal = Number(input.goalAmount);
      if (!title) return { error: "A title is required." };
      if (!Number.isFinite(goal) || goal < 1) return { error: "A valid goal amount is required." };
      return withTenant(orgId, async (tx) => {
        let slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 50) || "campaign";
        if (await tx.campaign.findFirst({ where: { orgId, slug } })) {
          slug = `${slug}-${Math.floor(performance.now())}`.slice(0, 60);
        }
        const c = await tx.campaign.create({
          data: { orgId, title, slug, goalAmount: goal, status: "draft", accent: "🎯" },
        });
        return {
          created: true,
          status: "draft",
          title: c.title,
          note: "Created as a DRAFT — review and publish it from the Campaigns page.",
          manageUrl: `/dashboard/campaigns/${c.id}`,
        };
      });
    }
    case "export_csv": {
      const type = String(input.type ?? "");
      if (!["donors", "donations", "receipts"].includes(type)) return { error: "type must be donors, donations, or receipts" };
      return { downloadUrl: `/api/export/${type}`, note: `Open this link to download your ${type} CSV.` };
    }
    default:
      return { error: `unknown tool ${name}` };
  }
}
