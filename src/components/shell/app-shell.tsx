"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Lets the Topbar (rendered inside children) open the mobile drawer. */
const MobileNavContext = createContext<{ open: () => void } | null>(null);
export function useMobileNav() {
  return useContext(MobileNavContext);
}

function NavLinks({
  items,
  base,
  onNavigate,
  hidden,
}: {
  items: NavItem[];
  base: string;
  onNavigate?: () => void;
  /** True when this copy of the nav is off-screen (closed mobile drawer). */
  hidden?: boolean;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
      {items.map((item) => {
        const active =
          item.href === base
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            // A closed drawer is only translated off-screen, so without this its
            // links stay in the tab order and keyboard focus disappears into a
            // panel the user can't see.
            tabIndex={hidden ? -1 : undefined}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-brand-50 text-brand-700"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )}
          >
            <item.icon className="size-[18px] shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({
  items,
  base,
  homeHref,
  footer,
  children,
}: {
  items: NavItem[];
  base: string;
  homeHref: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawerRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  // close the drawer on navigation
  useEffect(() => setOpen(false), [pathname]);

  // lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Keyboard handling for the mobile drawer: move focus in, keep Tab inside it,
  // close on Escape, and return focus to the button that opened it.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;

    const focusables = () =>
      Array.from(
        drawerRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );

    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  return (
    <MobileNavContext.Provider value={{ open: () => setOpen(true) }}>
      <div className="flex min-h-screen bg-secondary/30">
        {/* desktop sidebar */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card lg:flex">
          <div className="flex h-16 items-center border-b border-border px-6">
            <Link href={homeHref} aria-label="KindPath">
              <Logo />
            </Link>
          </div>
          <NavLinks items={items} base={base} />
          {footer && <div className="border-t border-border p-3">{footer}</div>}
        </aside>

        {/* mobile drawer + backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-50 bg-foreground/40 backdrop-blur-sm transition-opacity lg:hidden",
            open ? "opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setOpen(false)}
          aria-hidden
        />
        <aside
          ref={drawerRef}
          id="mobile-nav"
          role="dialog"
          aria-modal={open}
          aria-hidden={!open}
          inert={!open}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-border bg-card transition-transform duration-300 lg:hidden",
            open ? "translate-x-0" : "-translate-x-full"
          )}
          aria-label="Navigation"
        >
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <Link
              href={homeHref}
              aria-label="KindPath"
              tabIndex={open ? undefined : -1}
              onClick={() => setOpen(false)}
            >
              <Logo />
            </Link>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              tabIndex={open ? undefined : -1}
              className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary"
            >
              <X className="size-5" />
            </button>
          </div>
          <NavLinks items={items} base={base} hidden={!open} onNavigate={() => setOpen(false)} />
          {footer && <div className="border-t border-border p-3">{footer}</div>}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      </div>
    </MobileNavContext.Provider>
  );
}
