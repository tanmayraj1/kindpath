"use client";

import { Database, FlaskConical, Wallet, Gauge } from "lucide-react";
import { Counter, Stagger, StaggerItem } from "@/components/motion/primitives";
import { FlowLines } from "@/components/motion/line-art";

/**
 * Four numbers, each one checkable.
 *
 * The layout this follows shows headline business metrics here — money raised,
 * retention, customer counts. KindPath has no customers, and inventing those was
 * already caught and removed once in this codebase (see the note in
 * src/app/page.tsx). So these are properties of the software instead, and every
 * one of them was measured rather than estimated:
 *
 *   22   `select count(*) from pg_tables where rowsecurity = true`
 *   178  the suite `npm test` runs
 *   0    no code path holds donor funds — charges settle to the org's own
 *        merchant account, which is why there is no balance to report
 *   50k  the seeded load-test dataset every list page was profiled against
 *
 * If any of these stops being true, the number is wrong and should be changed
 * here rather than rounded up.
 */
const stats = [
  {
    icon: Database,
    value: 22,
    suffix: "",
    label: "Tables isolated by row-level security",
    detail: "Enforced by Postgres, re-verified from the catalog on every deploy.",
  },
  {
    icon: FlaskConical,
    value: 178,
    suffix: "",
    label: "Automated tests on every commit",
    detail: "Receipting, consent, tenancy and payment adapters.",
  },
  {
    icon: Wallet,
    value: 0,
    prefix: "$",
    label: "Of your donations we ever hold",
    detail: "Money settles directly into your own merchant account.",
  },
  {
    icon: Gauge,
    value: 50,
    suffix: "k",
    label: "Donations load-tested per organization",
    detail: "Every list page profiled under 500ms at that volume.",
  },
];

export function StatsBand() {
  return (
    <section className="relative overflow-hidden border-y border-border bg-secondary/30 py-16">
      <FlowLines className="opacity-[0.5]" lines={4} />

      <Stagger className="container relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4" step={0.1}>
        {stats.map((s) => (
          <StaggerItem key={s.label} className="text-center sm:text-left">
            <span className="mb-4 inline-grid size-11 place-items-center rounded-xl border border-border bg-card text-brand-600 shadow-sm">
              <s.icon className="size-5" aria-hidden />
            </span>
            <p className="font-display text-4xl font-extrabold tracking-tight">
              <Counter
                to={s.value}
                prefix={s.prefix ?? ""}
                suffix={s.suffix ?? ""}
                duration={1.4}
              />
            </p>
            <p className="mt-1 text-sm font-semibold">{s.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.detail}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
