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
    // Proof section: dark on mint. The reference floats these over a photograph;
    // there is no photograph of this product in use because there are no users
    // yet, and a stock image of a congregation would imply one. The ink panel
    // does the same job — it separates the claim from the page and gives the
    // chips something to sit on — without asserting anything untrue.
    <section className="relative overflow-hidden bg-secondary/60 py-16 sm:py-24">
      <div className="container">
        <div className="relative overflow-hidden rounded-card bg-ink px-6 py-14 sm:px-12">
          <FlowLines className="opacity-30" lines={4} />

          <div className="relative mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-paper sm:text-4xl">
              See how KindPath transforms giving
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-paper/60">
              Not a pitch — four properties of the software you can check yourself.
            </p>
          </div>

          <Stagger
            className="relative mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            step={0.1}
          >
            {stats.map((s) => (
              <StaggerItem key={s.label}>
                <div className="flex h-full flex-col gap-3 rounded-card bg-paper/[0.06] p-5 backdrop-blur">
                  <span className="inline-grid size-11 place-items-center rounded-full bg-paper/10 text-lime">
                    <s.icon className="size-5 stroke-[1.5]" aria-hidden />
                  </span>
                  <p className="font-display text-4xl font-extrabold tracking-tight text-paper">
                    <Counter
                      to={s.value}
                      prefix={s.prefix ?? ""}
                      suffix={s.suffix ?? ""}
                      duration={1.4}
                    />
                  </p>
                  <div>
                    <p className="text-sm font-semibold text-paper">{s.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-paper/55">{s.detail}</p>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      </div>
    </section>
  );
}
