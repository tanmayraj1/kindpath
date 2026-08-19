"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, CornerDownLeft, Plus, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { NavItem } from "./app-shell";
import { cn } from "@/lib/utils";

type Entry = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
  /** Extra words the filter should match ("gifts" → Recurring plans). */
  keywords?: string;
};

/**
 * ⌘K navigation for the three signed-in shells.
 *
 * Daily users end up somewhere in a 15-item sidebar dozens of times a day;
 * this turns any destination into three keystrokes. Deliberately built on the
 * nav list the shell already owns, so a new page added to the sidebar appears
 * here without anyone remembering a second registry.
 *
 * The dashboard additionally gets "search donors" as a free-text action: it
 * simply navigates to the donor list with ?q=, reusing the server-side search
 * that page already has rather than inventing a parallel search API.
 */
export function CommandPalette({ items, base }: { items: NavItem[]; base: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useMemo<Entry[]>(() => {
    const nav: Entry[] = items.map((i) => ({ ...i, hint: "Go to" }));
    if (base === "/dashboard") {
      nav.unshift({
        href: "/dashboard/donations/new",
        label: "New donation",
        icon: Plus,
        hint: "Action",
        keywords: "record cash cheque add gift",
      });
    }
    return nav;
  }, [items, base]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? entries.filter((e) => `${e.label} ${e.keywords ?? ""}`.toLowerCase().includes(q))
    : entries;

  // Free-text donor search rides below the matches, never replaces them.
  const donorSearch = base === "/dashboard" && q.length > 1;
  const total = filtered.length + (donorSearch ? 1 : 0);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router]
  );

  // Global shortcut. ⌘K is muscle memory from every other tool of this shape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [index]);

  if (!open) return null;

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, total - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (index < filtered.length) {
        go(filtered[index].href);
      } else if (donorSearch) {
        go(`/dashboard/donors?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-foreground/40 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIndex(0);
            }}
            onKeyDown={onInputKey}
            placeholder="Where to? Type to filter…"
            aria-label="Search pages and actions"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {filtered.map((e, i) => (
            <li key={e.href} data-index={i} role="option" aria-selected={i === index}>
              <button
                type="button"
                onClick={() => go(e.href)}
                onMouseMove={() => setIndex(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                  i === index ? "bg-brand-50 text-brand-700" : "text-foreground"
                )}
              >
                <e.icon
                  className={cn(
                    "size-4 shrink-0",
                    i === index ? "text-brand-600" : "text-muted-foreground"
                  )}
                  aria-hidden
                />
                <span className="flex-1">{e.label}</span>
                <span className="text-xs text-muted-foreground">{e.hint}</span>
                {i === index && (
                  <CornerDownLeft className="size-3.5 text-muted-foreground" aria-hidden />
                )}
              </button>
            </li>
          ))}

          {donorSearch && (
            <li data-index={filtered.length} role="option" aria-selected={index === filtered.length}>
              <button
                type="button"
                onClick={() => go(`/dashboard/donors?q=${encodeURIComponent(query.trim())}`)}
                onMouseMove={() => setIndex(filtered.length)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm",
                  index === filtered.length ? "bg-brand-50 text-brand-700" : "text-foreground"
                )}
              >
                <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="flex-1">
                  Search donors for “<span className="font-medium">{query.trim()}</span>”
                </span>
                <span className="text-xs text-muted-foreground">Search</span>
              </button>
            </li>
          )}

          {total === 0 && (
            <li className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query.trim()}”.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
