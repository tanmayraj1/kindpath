"use client";

import { Section, SectionHeading } from "@/components/ui/section";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

/**
 * Bento grid: who this is for, shown as four tinted cards with a UI vignette.
 *
 * The traditions are listed alphabetically and given identical visual weight —
 * same card size, same vignette complexity, tints rotated rather than ranked.
 * A platform that serves temples, churches and mosques equally cannot have a
 * "main" one on its homepage, and card size is the loudest way to imply one.
 * The multi-campus card is last because it is a different axis (scale, not
 * tradition), not because it matters least.
 *
 * The vignettes are styled divs, not screenshots: they never go stale against
 * the product, they cost no image request, and they inherit the palette.
 */

const cases = [
  {
    name: "Churches",
    line: "Weekly offering, building funds and year-end receipts, handled.",
    tint: "bg-secondary",
    vignette: "rows",
  },
  {
    name: "Mosques",
    line: "Zakat and Sadaqah tracked as separate funds, receipted correctly.",
    tint: "bg-accent/30",
    vignette: "funds",
  },
  {
    name: "Temples",
    line: "Seva and festival campaigns, receipted automatically.",
    tint: "bg-brand-100",
    vignette: "campaign",
  },
  {
    name: "Multi-campus organizations",
    line: "Every location on its own books, one place to see them all.",
    tint: "bg-periwinkle/30",
    vignette: "sites",
  },
] as const;

/** Miniature stylised UI. Decorative — the card's text carries the meaning. */
function Vignette({ kind }: { kind: (typeof cases)[number]["vignette"] }) {
  const bar = "h-2 rounded-full bg-foreground/10";
  const chip = "h-5 rounded-full bg-card shadow-soft";

  return (
    <div aria-hidden className="rounded-xl bg-card/70 p-3 shadow-soft backdrop-blur">
      {kind === "rows" && (
        <div className="flex flex-col gap-2">
          {[80, 62, 71, 45].map((w, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="size-4 shrink-0 rounded-full bg-brand-300" />
              <span className={bar} style={{ width: `${w}%` }} />
            </div>
          ))}
        </div>
      )}
      {kind === "funds" && (
        <div className="flex flex-col gap-2.5">
          {[
            ["Zakat", 64],
            ["Sadaqah", 41],
            ["Building", 26],
          ].map(([name, pct]) => (
            <div key={String(name)}>
              <div className="mb-1 flex justify-between text-[10px] font-medium">
                <span>{name}</span>
                <span className="tnum text-muted-foreground">{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-foreground/10">
                <div className="h-full rounded-full bg-brand-600" style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {kind === "campaign" && (
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-1.5">
            {[40, 65, 52, 88, 70, 96].map((h, i) => (
              <span
                key={i}
                className={cn("w-full rounded-t-md", i % 2 ? "bg-periwinkle" : "bg-lime")}
                style={{ height: `${h * 0.4}px` }}
              />
            ))}
          </div>
          <span className={cn(bar, "w-2/3")} />
        </div>
      )}
      {kind === "sites" && (
        <div className="flex flex-col gap-2">
          {["North campus", "Downtown", "East"].map((s) => (
            <div key={s} className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-medium">{s}</span>
              <span className={cn(chip, "w-12")} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function UseCases() {
  return (
    <Section id="use-cases">
      <div className="container">
        <SectionHeading
          eyebrow="Who it's for"
          title="Built for every community"
          description="One platform, whatever your tradition calls the fund — and however many locations you run."
        />

        <Stagger className="mt-14 grid gap-5 sm:grid-cols-2" step={0.08}>
          {cases.map((c) => (
            <StaggerItem key={c.name} className="h-full">
              <div
                className={cn(
                  "flex h-full flex-col gap-4 rounded-card p-6 transition-shadow hover:shadow-lift",
                  c.tint
                )}
              >
                <Vignette kind={c.vignette} />
                <div>
                  <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.line}</p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Section>
  );
}
