import Link from "next/link";
import { ArrowRight, ShieldCheck, FileCheck2, Repeat, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Tilt } from "@/components/motion/primitives";
import { OrbitRings } from "@/components/motion/line-art";
import { HeroPreview } from "./hero-preview";

const proof = [
  { icon: FileCheck2, label: "Automated tax receipts" },
  { icon: Repeat, label: "Recurring giving" },
  { icon: ShieldCheck, label: "No setup fees" },
];

const headline = ["Modern", "giving", "for", "faith", "communities"];

/**
 * Centre-stacked hero: badge, headline, sub, actions, then the product itself.
 *
 * The previous two-column split put the product preview beside the copy at half
 * width, so the thing being sold was the smaller object on the page. A single
 * centred column with the preview at full measure below it makes the product the
 * largest element in the first screen, which is most of the argument a landing
 * page has.
 *
 * The entrance is CSS keyframes with staggered animation-delay, NOT framer-motion,
 * and that is deliberate. framer-motion drives animation from requestAnimationFrame,
 * which browsers pause outright in a background tab; CSS animation timelines are
 * throttled there but keep advancing. So a visitor who cmd-clicks this page and
 * comes back to the tab finds the hero written in either way, rather than sitting
 * at the initial opacity:0 a paused rAF would have left it at.
 *
 * (Caveat worth knowing before "fixing" this: in a page that is never rendered at
 * all — a hidden automation pane — the document timeline is frozen and CSS stalls
 * at currentTime 0 as well. That case is not a real visitor, but it does mean a
 * screenshot tool can show you an empty hero that users would never see.)
 *
 * The bigger reason is plainer: this stays a server component, so the headline
 * ships as HTML with no JS required to become readable. Everything below the fold
 * is scroll-triggered and genuinely needs the viewport, which is where
 * framer-motion earns its place.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient background: grid, brand bloom, slow concentric rings */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint opacity-[0.4] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-52 left-1/2 -z-10 size-[46rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[130px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[42rem] -translate-x-1/2 opacity-70"
      >
        <OrbitRings />
      </div>

      <div className="container flex flex-col items-center gap-7 py-20 text-center sm:py-28">
        <span className="inline-flex animate-rise-in items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3.5 py-1.5 text-xs font-semibold text-brand-700 backdrop-blur">
          <Sparkles className="size-3.5" aria-hidden />
          CRA-compliant receipts · Made in Canada
        </span>

        {/* Per-word release reads as writing; a single fade on five words reads as
            a slide transition. It finishes inside a second so it never delays
            comprehension of the one line that has to land. */}
        <h1 className="max-w-4xl font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
          {headline.map((word, i) => (
            <span
              key={word}
              className={cn("inline-block animate-rise-in", i >= 3 && "text-gradient")}
              style={{ animationDelay: `${80 + i * 70}ms` }}
            >
              {word}
              {i < headline.length - 1 ? " " : ""}
            </span>
          ))}
        </h1>

        <p
          className="max-w-2xl animate-rise-in text-lg leading-relaxed text-muted-foreground"
          style={{ animationDelay: "440ms" }}
        >
          Collect one-time and recurring donations, issue CRA-compliant tax receipts
          automatically, and manage every donor — from one branded platform built for Canadian
          temples, churches and mosques.
        </p>

        <div
          className="flex animate-rise-in flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "520ms" }}
        >
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "group")}>
            Start your free trial
            <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link href="#how-it-works" className={buttonVariants({ variant: "outline", size: "lg" })}>
            See how it works
          </Link>
        </div>

        <div
          className="flex animate-rise-in flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground"
          style={{ animationDelay: "600ms" }}
        >
          {proof.map((p) => (
            <span key={p.label} className="flex items-center gap-2">
              <p.icon className="size-4 text-success" aria-hidden />
              {p.label}
            </span>
          ))}
        </div>

        <div
          className="relative mt-6 w-full animate-rise-in [perspective:1400px]"
          style={{ animationDelay: "680ms" }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-10 top-10 -z-10 h-64 rounded-[50%] bg-brand-gradient opacity-25 blur-[90px]"
          />
          <Tilt strength={4} className="mx-auto w-full max-w-md">
            <HeroPreview />
          </Tilt>
        </div>
      </div>
    </section>
  );
}
