"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { seg: "", label: "Overview" },
  { seg: "donors", label: "Donors" },
  { seg: "receipts", label: "Receipts" },
  { seg: "funds", label: "Funds" },
  { seg: "recurring", label: "Recurring" },
  { seg: "subscription", label: "Subscription" },
  { seg: "features", label: "Features" },
  { seg: "users", label: "Users" },
  { seg: "settings", label: "Settings" },
];

export function OrgAdminTabs({ orgId }: { orgId: string }) {
  const pathname = usePathname();
  const baseHref = `/admin/organizations/${orgId}`;

  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => {
        const href = t.seg ? `${baseHref}/${t.seg}` : baseHref;
        const active = pathname === href;
        return (
          <Link
            key={t.label}
            href={href}
            className={cn(
              "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
