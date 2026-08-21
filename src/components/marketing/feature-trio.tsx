"use client";

import { Section, SectionHeading } from "@/components/ui/section";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

/**
 * Three cards, each topped by a miniature of a real surface in the product.
 *
 * The thumbnails are styled divs, not screenshots. A screenshot of a product
 * that ships weekly is stale the moment it is taken, and nothing in the build
 * catches it — whereas these are made of the same tokens as the thing they
 * depict, so a palette change carries through automatically. They are also
 * ~1KB of markup instead of three retina PNGs.
 *
 * Marked aria-hidden throughout: each card's caption already says what the
 * surface does, and a screen reader gaining nothing from "image" three times is
 * the whole argument for not describing decoration.
 */

const bar = "rounded-full bg-foreground/10";

/** The public branded donation page, in miniature. */
function GivingMock() {
  return (
    <div aria-hidden className="flex flex-col gap-2 rounded-xl bg-card p-3 shadow-soft">
      <div className="flex items-center gap-2">
        <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-brand-100 text-[9px] font-bold text-brand-700">
          ST
        </span>
        <span className={cn(bar, "h-2 w-20")} />
      </div>
      <p className="text-center font-display text-lg font-bold">$50</p>
      <div className="grid grid-cols-4 gap-1">
        {["25", "50", "100", "250"].map((a) => (
          <span
            key={a}
            className={cn(
              "rounded-full py-1 text-center text-[9px] font-semibold",
              a === "50" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
            )}
          >
            ${a}
          </span>
        ))}
      </div>
      <span className="mt-0.5 rounded-full bg-primary py-1.5 text-center text-[9px] font-semibold text-primary-foreground">
        Give securely
      </span>
    </div>
  );
}

/** The org dashboard's stat row, in miniature — lime hero included. */
function DashboardMock() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-2">
      <div className="col-span-1 rounded-xl bg-lime p-2.5 shadow-soft">
        <span className="block size-4 rounded-full bg-ink/10" />
        <p className="mt-2 font-display text-sm font-bold text-ink">$155k</p>
        <p className="text-[8px] text-ink/70">Raised this month</p>
      </div>
      <div className="flex flex-col gap-2">
        {[
          ["5,007", "Donors"],
          ["482", "Receipts"],
        ].map(([v, l]) => (
          <div key={l} className="rounded-xl bg-card p-2 shadow-soft">
            <p className="font-display text-[11px] font-bold">{v}</p>
            <p className="text-[8px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      <div className="col-span-2 flex items-end gap-1 rounded-xl bg-card p-2.5 shadow-soft">
        {[38, 60, 45, 78, 64, 90].map((h, i) => (
          <span
            key={i}
            className={cn("w-full rounded-t", i % 2 ? "bg-periwinkle" : "bg-lime")}
            style={{ height: `${h * 0.32}px` }}
          />
        ))}
      </div>
    </div>
  );
}

/** An official receipt PDF, in miniature. */
function ReceiptMock() {
  return (
    <div aria-hidden className="rounded-xl bg-card p-3 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[9px] font-bold">Official receipt</p>
          <p className="tnum text-[8px] text-muted-foreground">No. 2026-000481</p>
        </div>
        <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-[8px] font-semibold text-success">
          Issued
        </span>
      </div>
      <div className="mt-2.5 flex flex-col gap-1.5">
        {[70, 52, 84].map((w, i) => (
          <span key={i} className={cn(bar, "h-1.5")} style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className="mt-2.5 flex items-baseline justify-between border-t border-border pt-2">
        <span className="text-[8px] text-muted-foreground">Eligible amount</span>
        <span className="tnum font-display text-xs font-bold">$250.00</span>
      </div>
    </div>
  );
}

const trio = [
  {
    tint: "from-brand-100 to-secondary",
    mock: <GivingMock />,
    caption: "A branded donation page your community recognises — one link, or a QR code.",
  },
  {
    tint: "from-secondary to-periwinkle/30",
    mock: <DashboardMock />,
    caption: "Every fund, donor and receipt in one dashboard your board can actually read.",
  },
  {
    tint: "from-accent/30 to-brand-100",
    mock: <ReceiptMock />,
    caption: "CRA-compliant receipts issued automatically, with gap-free serial numbers.",
  },
];

export function FeatureTrio() {
  return (
    <Section>
      <div className="container">
        <SectionHeading
          eyebrow="How it looks"
          title="From the first gift to the tax receipt"
          description="One system end to end, so nothing is re-keyed and nothing falls between two tools."
        />

        <Stagger className="mt-14 grid gap-5 md:grid-cols-3" step={0.08}>
          {trio.map((t, i) => (
            <StaggerItem key={i} className="h-full">
              <div className="flex h-full flex-col overflow-hidden rounded-card border border-border bg-card shadow-soft">
                <div className={cn("bg-gradient-to-br p-5", t.tint)}>{t.mock}</div>
                <p className="p-5 text-sm leading-relaxed text-muted-foreground">{t.caption}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
