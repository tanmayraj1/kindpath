"use client";

import { Menu } from "lucide-react";
import { UserMenu } from "./user-menu";
import { useMobileNav } from "@/components/shell/app-shell";

export function Topbar({
  title,
  user,
  action,
}: {
  title: string;
  user: { name: string; email: string };
  action?: React.ReactNode;
}) {
  const nav = useMobileNav();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex min-w-0 items-center gap-2">
        {nav && (
          <button
            type="button"
            onClick={nav.open}
            aria-label="Open menu"
            className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-secondary lg:hidden"
          >
            <Menu className="size-5" />
          </button>
        )}
        <h1 className="truncate font-display text-base font-semibold tracking-tight sm:text-lg">
          {title}
        </h1>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {action}
        <UserMenu name={user.name} email={user.email} />
      </div>
    </header>
  );
}
