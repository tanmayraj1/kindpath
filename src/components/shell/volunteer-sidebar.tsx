"use client";

import { LayoutDashboard, UserCog } from "lucide-react";
import { AppShell, type NavItem } from "./app-shell";

const items: NavItem[] = [
  { href: "/volunteer", label: "My passes", icon: LayoutDashboard },
  { href: "/volunteer/profile", label: "Profile", icon: UserCog },
];

export function VolunteerShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell items={items} base="/volunteer" homeHref="/volunteer">
      {children}
    </AppShell>
  );
}
