import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Badge } from "@/components/ui/badge";
import { OrgAdminTabs } from "@/components/admin/org-admin-tabs";
import { OrgQuickActions } from "@/components/admin/org-quick-actions";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { getOrgManage } from "@/lib/queries/admin";
import { formatCAD } from "@/lib/utils";

export default async function OrgManageLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const session = await requirePlatformAdmin();
  const org = await getOrgManage(params.id);
  if (!org) notFound();

  const statusVariant =
    org.status === "active" ? "success" : org.status === "suspended" ? "warning" : "neutral";

  return (
    <>
      <Topbar title="Manage organization" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Link
          href="/admin/organizations"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> All organizations
        </Link>

        {/* header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="grid size-14 place-items-center rounded-2xl bg-brand-gradient text-lg font-display font-bold text-white">
              {org.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-2xl font-bold">{org.name}</h2>
                <Badge variant={statusVariant} className="capitalize">
                  {org.status}
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="capitalize">{org.plan} plan</span>
                <span>·</span>
                <span>{org.counts.donors} donors</span>
                <span>·</span>
                <span>{formatCAD(org.raised, { maximumFractionDigits: 0 })} raised</span>
                <a
                  href={`/give/${org.slug}`}
                  target="_blank"
                  rel="noopener"
                  className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                >
                  /give/{org.slug} <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          </div>
          <OrgQuickActions orgId={org.id} status={org.status} />
        </div>

        <OrgAdminTabs orgId={org.id} />

        {children}
      </main>
    </>
  );
}
