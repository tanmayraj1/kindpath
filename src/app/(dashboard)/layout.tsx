import { ShieldOff } from "lucide-react";
import { OrgShell } from "@/components/shell/org-sidebar";
import { Logo } from "@/components/brand/logo";
import { logoutAction } from "@/app/(auth)/actions";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrgPlanUsage } from "@/lib/queries/org-dashboard";
import { getOrgAccess } from "@/lib/access";
import { BillingBanner } from "@/components/dashboard/billing-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireOrgUser();
  const [usage, access] = await Promise.all([
    getOrgPlanUsage(session.orgId),
    getOrgAccess(session.orgId),
  ]);

  // Access revoked (suspended org or unpaid past the grace window) → lock the app,
  // but never imply data loss: everything is retained and exportable on restore.
  if (!access.active) {
    const unpaid = access.billing === "locked" && access.status === "active";
    return (
      <div className="grid min-h-screen place-items-center bg-secondary/30 p-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="flex justify-center">
            <Logo />
          </div>
          <span className="mx-auto mt-6 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
            <ShieldOff className="size-6" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold">Account access paused</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {unpaid
              ? "Your subscription has an unpaid invoice, so the dashboard is paused."
              : `Your organization's access is currently ${
                  access.status === "suspended" ? "suspended" : "inactive"
                }.`}{" "}
            Nothing has been deleted — your donors, donation history and every receipt you&apos;ve
            issued are retained and will be exactly as you left them.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Contact KindPath support to restore access.
          </p>
          <form action={logoutAction} className="mt-6">
            <button type="submit" className="text-sm font-medium text-brand-600 hover:underline">
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <OrgShell
      plan={usage.plan}
      donors={usage.donors}
      limit={usage.limit}
      pct={usage.pct}
      features={access.features}
    >
      <BillingBanner billing={access.billing} daysLeft={access.daysLeft} />
      {children}
    </OrgShell>
  );
}
