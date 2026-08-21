"use client";

import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, TrendingUp, Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Section, SectionHeading } from "@/components/ui/section";
import { EASE, FadeIn } from "@/components/motion/primitives";
import { SparkRise } from "@/components/motion/line-art";

/**
 * What the software does, shown rather than listed.
 *
 * Left: three small panels standing in for real surfaces in the product — a
 * fund breakdown, a receipt state, a giving trend. Right: the capability cloud.
 *
 * The chart is illustrative and says so in its caption. Rendering an unlabelled
 * upward line beside marketing copy invites the reader to take it for this
 * product's actual results, which do not exist yet.
 */

const funds = [
  { name: "General Fund", pct: 62 },
  { name: "Building Fund", pct: 24 },
  { name: "Missions", pct: 14 },
];

/**
 * Capability pills for the gradient panel.
 *
 * Every one of these is a shipped surface, not a roadmap — each maps to a route
 * or a table in this repo. Rows are offset from each other so the block reads as
 * a drift rather than a table, and there are enough of them to fill the panel:
 * four rows left a third of the gradient empty and the section looked unbalanced
 * against the stack of cards beside it.
 */
const rows = [
  ["Recurring plans", "CRA receipts", "Fund tracking"],
  ["CASL consent", "Donor portal", "QR giving"],
  ["Split receipting", "Pledge drives", "Event tickets"],
  ["Law 25 erasure", "Team roles", "Audit log"],
  ["Memberships", "Kiosk mode", "Campaigns"],
  ["Volunteers", "Annual receipts", "Exports"],
  ["Failed-gift retries", "Impact reports", "Multi-fund"],
];

export function Showcase() {
  const reduced = useReducedMotion();

  return (
    <Section id="showcase">
      <div className="container">
      <SectionHeading
        eyebrow="What you get"
        title="Everything a Canadian charity needs, in one place"
        description="Receipting, recurring giving, donor records and compliance — not four tools stitched together."
      />

      <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-2">
        {/* ── left: product surfaces ─────────────────────────────────── */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-1">
          <div className="grid gap-6 sm:grid-cols-2">
            <FadeIn direction="up">
              <Card className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Users2 className="size-4 text-brand-600" aria-hidden />
                    Giving by fund
                  </div>
                  <div className="mt-4 flex flex-col gap-3">
                    {funds.map((f, i) => (
                      <div key={f.name}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium">{f.name}</span>
                          <span className="tnum text-muted-foreground">{f.pct}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <motion.div
                            className="h-full rounded-full bg-brand-gradient"
                            initial={reduced ? undefined : { width: 0 }}
                            whileInView={reduced ? undefined : { width: `${f.pct}%` }}
                            viewport={{ once: true, amount: 0.6 }}
                            transition={{ duration: 1, delay: 0.15 + i * 0.12, ease: EASE }}
                            style={reduced ? { width: `${f.pct}%` } : undefined}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>

            <FadeIn direction="up" delay={0.1}>
              <Card className="h-full">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-success" aria-hidden />
                    Receipt issued
                  </div>
                  <p className="tnum mt-4 font-display text-2xl font-bold">2026-000481</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Serial numbers are gap-free by design — the CRA requires it, so the number is
                    allocated in the same transaction as the receipt.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {["Eligible amount", "Advantage split", "Emailed"].map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          </div>

          <FadeIn direction="up" delay={0.18}>
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <TrendingUp className="size-4 text-brand-600" aria-hidden />
                    Giving over time
                  </div>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    Illustrative
                  </span>
                </div>
                <SparkRise className="mt-3" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Twelve-month trend, top donors and fund-wise revenue — the report your board
                  actually reads.
                </p>
              </CardContent>
            </Card>
          </FadeIn>
        </div>

        {/* ── right: capability cloud ────────────────────────────────── */}
        <FadeIn direction="left" delay={0.1} className="min-h-[26rem]">
          <div className="relative flex h-full flex-col overflow-hidden rounded-2xl bg-brand-gradient p-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.35),transparent_60%)]"
            />
            <p className="relative mb-5 max-w-[18rem] font-display text-lg font-bold leading-snug text-white">
              Every one of these ships today — not a roadmap.
            </p>
            <div className="relative flex flex-1 flex-col justify-center gap-2.5">
              {rows.map((row, r) => (
                <div
                  key={r}
                  className="flex gap-3"
                  // Alternate rows sit half a pill out of phase so the grid reads
                  // as a drift rather than a table.
                  style={{ marginLeft: r % 2 ? "2.25rem" : 0 }}
                >
                  {row.map((label, c) => (
                    <motion.span
                      key={label}
                      className="shrink-0 whitespace-nowrap rounded-full bg-white/90 px-3.5 py-2 text-xs font-semibold text-brand-800 shadow-sm backdrop-blur"
                      initial={reduced ? undefined : { opacity: 0, y: 14, scale: 0.94 }}
                      whileInView={reduced ? undefined : { opacity: 1, y: 0, scale: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ duration: 0.5, delay: r * 0.09 + c * 0.06, ease: EASE }}
                    >
                      {label}
                    </motion.span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
      </div>
    </Section>
  );
}
