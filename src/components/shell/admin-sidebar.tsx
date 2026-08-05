"use client";

import { LayoutDashboard, Building2, CreditCard, Receipt, BarChart3, LifeBuoy } from "lucide-react";
import { AppShell, type NavItem } from "./app-shell";
import { Badge } from "@/components/ui/badge";

const items: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/revenue", label: "Revenue", icon: Receipt },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      items={items}
      base="/admin"
      homeHref="/admin"
      footer={
        <Badge variant="brand" className="w-full justify-center py-1.5">
          Platform admin
        </Badge>
      }
    >
      {children}
    </AppShell>
  );
}
