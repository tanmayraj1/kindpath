import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";

/**
 * Shell for the legal pages.
 *
 * These are DRAFTS pending counsel review, and they say so at the top rather
 * than quietly reading as finished policy. A privacy policy that a charity
 * relies on, and that its donors rely on, should not be lawyer-flavoured
 * placeholder text presented as the real thing.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="container max-w-3xl py-16">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p>

        <div className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-4 text-sm">
          <p className="font-medium text-foreground">Draft pending legal review.</p>
          <p className="mt-1 text-muted-foreground">
            This document describes how KindPath actually works today, but it has not yet been
            reviewed by Canadian counsel. It is not legal advice, and it should not be relied on as
            a final agreement until this notice is removed.
          </p>
        </div>

        <div className="prose-kindpath mt-10 flex flex-col gap-8">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}
