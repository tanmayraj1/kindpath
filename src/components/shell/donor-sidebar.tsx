"use client";

import {
  LayoutDashboard,
  History,
  Repeat,
  CreditCard,
  FileCheck2,
  UserCog,
} from "lucide-react";
import { AppShell, type NavItem } from "./app-shell";

const items: NavItem[] = [
  { href: "/portal", label: "Overview", icon: LayoutDashboard },
  { href: "/portal/history", label: "Donation history", icon: History },
  { href: "/portal/recurring", label: "Recurring giving", icon: Repeat },
  { href: "/portal/payment-methods", label: "Payment methods", icon: CreditCard },
  { href: "/portal/receipts", label: "Tax receipts", icon: FileCheck2 },
  { href: "/portal/profile", label: "Profile", icon: UserCog },
];

export function DonorShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell items={items} base="/portal" homeHref="/portal">
      {children}
    </AppShell>
  );
}
