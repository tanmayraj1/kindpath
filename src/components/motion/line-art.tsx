"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { EASE } from "./primitives";

/**
 * Animated 2D line graphics.
 *
 * All of it is inline SVG on brand tokens — no image assets, no canvas, nothing
 * to download. Two techniques, chosen per effect:
 *
 *  - Draw-on uses framer-motion's pathLength, so a stroke writes itself when the
 *    section scrolls into view.
 *  - Travelling pulses use SMIL <animateMotion>. It runs on the compositor with
 *    no JS on the main thread, which matters because several of these loop
 *    forever while the user reads. A rAF loop per dot would not be free.
 *
 * Every component is aria-hidden: this is texture, and a screen reader announcing
 * "graphic" a dozen times down the page is noise, not information.
 *
 * Under prefers-reduced-motion each one renders its finished state — the lines
 * are part of the composition, so removing them would leave holes in the layout.
 * They simply stop moving.
 */

/** Brand-tinted stroke gradient, id-scoped so multiple instances don't collide. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="hsl(var(--brand-500))" stopOpacity="0" />
        <stop offset="35%" stopColor="hsl(var(--brand-500))" stopOpacity="0.9" />
        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.9" />
      </linearGradient>
      <radialGradient id={`${id}-dot`}>
        <stop offset="0%" stopColor="hsl(var(--brand-400))" stopOpacity="1" />
        <stop offset="100%" stopColor="hsl(var(--brand-400))" stopOpacity="0" />
      </radialGradient>
    </defs>
  );
}

/**
 * Long horizontal filaments with pulses running along them.
 *
 * Used as a section backdrop. The paths are deliberately near-flat with a single
 * gentle swell — a busy squiggle competes with the text sitting on top of it.
 */
export function FlowLines({
  className,
  lines = 4,
  speed = 9,
}: {
  className?: string;
  lines?: number;
  speed?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();

  const paths = Array.from({ length: lines }, (_, i) => {
    const y = 60 + i * 46;
    const lift = 26 - i * 5;
    return `M -40 ${y} C 260 ${y - lift}, 560 ${y + lift}, 840 ${y - lift / 2} S 1240 ${y}, 1480 ${y - lift / 3}`;
  });

  return (
    <svg
      aria-hidden
      viewBox="0 0 1440 300"
      preserveAspectRatio="none"
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
    >
      <Defs id={uid} />
      {paths.map((d, i) => (
        <g key={i}>
          <motion.path
            id={`${uid}-p${i}`}
            d={d}
            fill="none"
            stroke={`url(#${uid}-stroke)`}
            strokeWidth={1.25}
            strokeLinecap="round"
            initial={reduced ? undefined : { pathLength: 0, opacity: 0 }}
            whileInView={reduced ? undefined : { pathLength: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.1 }}
            transition={{ duration: 1.8, delay: i * 0.14, ease: EASE }}
          />
          {!reduced && (
            <circle r={3.5} fill={`url(#${uid}-dot)`}>
              <animateMotion
                dur={`${speed + i * 1.7}s`}
                repeatCount="indefinite"
                begin={`${i * 1.3}s`}
                rotate="auto"
              >
                <mpath href={`#${uid}-p${i}`} />
              </animateMotion>
            </circle>
          )}
        </g>
      ))}
    </svg>
  );
}

/**
 * The donation journey as a circuit: donor → gateway → receipt → portal.
 *
 * This one is literal rather than decorative — it traces the same four steps the
 * "How it works" copy describes, so the motion carries the meaning instead of
 * sitting beside it. Pulses travel donor-to-portal, never backwards.
 */
export function CircuitPath({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const d = "M 20 120 H 150 A 30 30 0 0 1 180 90 H 300 A 30 30 0 0 0 330 60 H 470 A 30 30 0 0 1 500 90 H 620 A 30 30 0 0 0 650 120 H 780";
  const nodes = [20, 180, 330, 500, 650, 780];

  return (
    <svg aria-hidden viewBox="0 0 800 180" className={cn("h-auto w-full", className)}>
      <Defs id={uid} />
      <path d={d} fill="none" stroke="hsl(var(--border))" strokeWidth={2} strokeLinecap="round" />
      <motion.path
        id={`${uid}-circuit`}
        d={d}
        fill="none"
        stroke={`url(#${uid}-stroke)`}
        strokeWidth={2.5}
        strokeLinecap="round"
        initial={reduced ? undefined : { pathLength: 0 }}
        whileInView={reduced ? undefined : { pathLength: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 2.2, ease: EASE }}
      />
      {nodes.map((x, i) => (
        <motion.circle
          key={x}
          cx={x}
          cy={i === 0 || i === 5 ? 120 : i === 2 ? 60 : 90}
          r={5}
          fill="hsl(var(--background))"
          stroke="hsl(var(--brand-500))"
          strokeWidth={2.5}
          initial={reduced ? undefined : { scale: 0, opacity: 0 }}
          whileInView={reduced ? undefined : { scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.4, delay: 0.3 + i * 0.3, ease: EASE }}
        />
      ))}
      {!reduced &&
        [0, 1].map((i) => (
          <circle key={i} r={4} fill="hsl(var(--brand-500))">
            <animateMotion dur="5s" begin={`${i * 2.5}s`} repeatCount="indefinite">
              <mpath href={`#${uid}-circuit`} />
            </animateMotion>
          </circle>
        ))}
    </svg>
  );
}

/**
 * A rising line chart that draws itself, with the area beneath filling in after.
 *
 * The shape is fixed, not random: this stands in for "giving over time" beside
 * product copy, and a chart that reshuffles on every render would be a picture of
 * nothing. It is illustrative and labelled as such where it is used.
 */
export function SparkRise({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedMotion();
  const line = "M 0 96 L 40 88 L 80 92 L 120 70 L 160 74 L 200 52 L 240 58 L 280 34 L 320 40 L 360 18";

  return (
    <svg aria-hidden viewBox="0 0 360 120" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand-500))" stopOpacity="0.28" />
          <stop offset="100%" stopColor="hsl(var(--brand-500))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.path
        d={`${line} L 360 120 L 0 120 Z`}
        fill={`url(#${uid}-fill)`}
        initial={reduced ? undefined : { opacity: 0 }}
        whileInView={reduced ? undefined : { opacity: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.9, delay: 1, ease: EASE }}
      />
      <motion.path
        d={line}
        fill="none"
        stroke="hsl(var(--brand-600))"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduced ? undefined : { pathLength: 0 }}
        whileInView={reduced ? undefined : { pathLength: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 1.6, ease: EASE }}
      />
    </svg>
  );
}

/**
 * Concentric rings that breathe, behind a focal element.
 *
 * Slow on purpose — 8s a cycle. Anything faster in a page's peripheral vision
 * pulls the eye off the copy it is meant to sit behind.
 */
export function OrbitRings({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <svg aria-hidden viewBox="0 0 400 400" className={cn("h-full w-full", className)}>
      {[70, 120, 170, 200].map((r, i) => (
        <motion.circle
          key={r}
          cx={200}
          cy={200}
          r={r}
          fill="none"
          stroke="hsl(var(--brand-500))"
          strokeOpacity={0.16}
          strokeWidth={1}
          strokeDasharray={i % 2 ? "4 10" : undefined}
          animate={reduced ? undefined : { scale: [1, 1.045, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, delay: i * 0.7, ease: "easeInOut" }}
          style={{ transformOrigin: "200px 200px" }}
        />
      ))}
    </svg>
  );
}
