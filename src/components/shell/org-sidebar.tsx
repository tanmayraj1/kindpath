"use client";

import {
  LayoutDashboard,
  QrCode,
  Users,
  Repeat,
  Landmark,
  Target,
  HandHeart,
  HeartHandshake,
  Award,
  Ticket,
  FileCheck2,
  BarChart3,
  Megaphone,
  Sparkles,
  UsersRound,
  ShieldCheck,
  Receipt,
  Settings,
} from "lucide-react";
import { AppShell, type NavItem } from "./app-shell";
import type { FeatureKey } from "@/lib/features";

const items: (NavItem & { feature?: FeatureKey })[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/giving", label: "Giving page & QR", icon: QrCode, feature: "qr" },
  { href: "/dashboard/donors", label: "Donors", icon: Users },
  { href: "/dashboard/recurring", label: "Recurring plans", icon: Repeat, feature: "recurring" },
  { href: "/dashboard/funds", label: "Funds", icon: Landmark, feature: "funds" },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Target, feature: "campaigns" },
  { href: "/dashboard/pledges", label: "Pledges", icon: HandHeart, feature: "campaigns" },
  { href: "/dashboard/memberships", label: "Memberships", icon: Award, feature: "memberships" },
  { href: "/dashboard/events", label: "Events", icon: Ticket, feature: "events" },
  { href: "/dashboard/volunteers", label: "Volunteers", icon: HeartHandshake, feature: "volunteers" },
  { href: "/dashboard/receipts", label: "Receipts", icon: FileCheck2, feature: "receipts" },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3, feature: "reports" },
  { href: "/dashboard/communications", label: "Communications", icon: Megaphone, feature: "communications" },
  { href: "/dashboard/assistant", label: "AI assistant", icon: Sparkles, feature: "assistant" },
  { href: "/dashboard/team", label: "Team", icon: UsersRound },
  { href: "/dashboard/security", label: "Security", icon: ShieldCheck },
  { href: "/dashboard/billing", label: "Billing", icon: Receipt },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function OrgShell({
  plan,
  donors,
  limit,
  pct,
  features,
  children,
}: {
  plan: string;
  donors: number;
  limit: number;
  pct: number;
  features: Record<string, boolean>;
  children: React.ReactNode;
}) {
  const visible = items.filter((i) => !i.feature || features[i.feature]);

  return (
    <AppShell
      items={visible}
      base="/dashboard"
      homeHref="/dashboard"
      footer={
        <div className="rounded-xl bg-brand-gradient p-4 text-white">
          <p className="text-sm font-semibold capitalize">{plan} plan</p>
          <p className="mt-1 text-xs text-white/80">
            {donors} / {limit} donors
          </p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
