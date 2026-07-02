"use client";

import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <p className="text-sm font-medium leading-tight">{name}</p>
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>
      <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
        {initials}
      </span>
      <form action={logoutAction}>
        <button
          type="submit"
          aria-label="Sign out"
          className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="size-[18px]" />
        </button>
      </form>
    </div>
  );
}
