"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Root-relative, not bare fragments.
 *
 * These were "#features" etc., which resolve against the CURRENT page — so on
 * /contact, /privacy, /terms and /dpa, where those ids don't exist, every
 * primary nav link was dead. "/#features" navigates home and then scrolls.
 */
const navLinks = [
  { href: "/#features", label: "Features" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" aria-label="KindPath home" onClick={() => setOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "hidden sm:inline-flex")}
          >
            Sign in
          </Link>
          <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "hidden sm:inline-flex")}>
            Start free trial
          </Link>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {/* mobile menu panel */}
      <div
        className={cn(
          "overflow-hidden border-t border-border/60 transition-[max-height] duration-300 md:hidden",
          open ? "max-h-96" : "max-h-0 border-t-0"
        )}
      >
        <div className="container flex flex-col gap-1 py-3">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-lg px-2 py-2.5 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2">
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className={buttonVariants({ size: "md" })}
            >
              Start free trial
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
