import Link from "next/link";
import { ArrowRight, Plus, MapPin } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroPreview } from "./hero-preview";

/**
 * Split hero: copy left, product card right.
 *
 * The headline uses the two-tone trick — the subject in ink, the qualifier in
 * muted grey. It does more work than a colour gradient did: it separates who
 * this is for from what it does, in one line, without a second sentence.
 *
 * Entrance is CSS keyframes with staggered animation-delay, NOT framer-motion.
 * framer-motion drives from requestAnimationFrame, which browsers pause outright
 * in a background tab; CSS timelines are throttled there but keep advancing. So
 * someone who cmd-clicks this page and comes back finds the hero written in
 * either way, rather than sitting at the opacity:0 a paused rAF would leave it
 * at. It also keeps this a server component — the headline ships as HTML and
 * needs no JS to be readable. Everything below the fold is scroll-triggered and
 * genuinely needs the viewport, which is where framer-motion earns its place.
 */

const checklist = [
  "Automated tax receipts",
  "Recurring giving",
  "No setup fees",
  "CRA-compliant",
];

/**
 * Anchored around the product card. Each names a surface that actually ships.
 *
 * `drift` holds the COMPLETE class, variant included. Tailwind scans source for
 * whole class strings, so building one as `"motion-safe:" + drift` produces a
 * class that is never generated and a pill that silently never floats.
 */
const floating = [
  { label: "CRA Receipts ✓", pos: "left-3 top-3", delay: "820ms", drift: "motion-safe:animate-float" },
  { label: "Recurring Giving", pos: "right-3 top-3", delay: "900ms", drift: "motion-safe:animate-float-slow" },
  { label: "Donor Portal", pos: "left-3 bottom-3", delay: "980ms", drift: "motion-safe:animate-float-slow" },
  { label: "QR Giving", pos: "right-3 bottom-3", delay: "1060ms", drift: "motion-safe:animate-float" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint opacity-40 [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]"
      />

      <div className="container grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:gap-10">
        {/* ── copy ───────────────────────────────────────────────────── */}
        <div className="flex flex-col items-start gap-6">
          <h1 className="max-w-xl font-display text-4xl font-bold leading-[1.06] tracking-tight sm:text-5xl lg:text-6xl">
            <span className="block animate-rise-in" style={{ animationDelay: "60ms" }}>
              Modern giving for
            </span>
            <span
              className="block animate-rise-in text-muted-foreground"
              style={{ animationDelay: "140ms" }}
            >
              faith communities.
            </span>
          </h1>

          <p
            className="max-w-lg animate-rise-in text-lg leading-relaxed text-muted-foreground"
            style={{ animationDelay: "240ms" }}
          >
            Collect one-time and recurring donations, issue CRA-compliant tax receipts
            automatically, and manage every donor — from one branded platform.
          </p>

          <div
            className="flex animate-rise-in flex-col gap-3 sm:flex-row"
            style={{ animationDelay: "320ms" }}
          >
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Start free trial
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className={buttonVariants({ variant: "ghost", size: "lg" })}
            >
              See how it works
            </Link>
          </div>

          {/* Stacked checklist card — the reference's "+" pill list. */}
          <ul
            className="w-full max-w-sm animate-rise-in rounded-card bg-secondary/70 p-4"
            style={{ animationDelay: "400ms" }}
          >
            {checklist.map((item) => (
              <li key={item} className="flex items-center gap-3 py-1.5 text-sm font-medium">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-200 text-brand-800">
                  <Plus className="size-3.5 stroke-[1.5]" aria-hidden />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* ── product card ───────────────────────────────────────────── */}
        <div
          className="relative animate-rise-in lg:mx-0"
          style={{ animationDelay: "480ms" }}
        >
          {/* Padding here is load-bearing: it reserves the band the floating pills
              sit in. Anchored to the CARD rather than to the column, because
              negative offsets outside it were being clipped by the section's
              overflow-hidden — which the ambient grid mask needs. */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-brand-200 via-secondary to-accent/50 p-4 pb-14 pt-14 shadow-soft sm:p-6 sm:pb-16 sm:pt-16">
            {/* The live branded-donation demo IS the hero artifact — it is the
                actual component the public giving page renders, not a picture of
                one, so it cannot drift out of date with the product. */}
            <HeroPreview />

            <div className="mt-5 flex items-center justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-card/90 px-3.5 py-1.5 text-xs font-medium shadow-soft backdrop-blur">
                <MapPin className="size-3.5 stroke-[1.5] text-brand-600" aria-hidden />
                Built for faith communities across Canada 🇨🇦
              </span>
            </div>

            {/* Hidden below sm: at 375px they would sit on top of the donation
                form they are meant to annotate. */}
            {floating.map((f) => (
              <span
                key={f.label}
                aria-hidden
                className={cn(
                  "absolute z-10 hidden animate-rise-in rounded-full bg-card px-3 py-1.5 text-xs font-semibold shadow-soft sm:block",
                  f.pos
                )}
                style={{ animationDelay: f.delay }}
              >
                <span className={cn("block", f.drift)}>{f.label}</span>
              </span>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
}
