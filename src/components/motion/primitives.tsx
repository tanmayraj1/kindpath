"use client";

import {
  motion,
  useReducedMotion,
  useInView,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared motion vocabulary for the marketing pages.
 *
 * Every primitive here collapses to "render, don't animate" when the OS asks for
 * reduced motion — not to a faster animation, to none. framer-motion's
 * useReducedMotion reads the same media query globals.css already honors, so the
 * two agree instead of one re-introducing what the other suppressed.
 *
 * The easing is one curve, used everywhere: a long tail that settles rather than
 * stops. Mixing curves across a page is what makes motion feel assembled from
 * parts, and this page has a lot of moving parts.
 */
export const EASE = [0.16, 1, 0.3, 1] as const;

/** One item rising into place. Used directly, or as a Stagger child. */
export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

type Dir = "up" | "down" | "left" | "right" | "none";

const offset: Record<Dir, { x: number; y: number }> = {
  up: { x: 0, y: 28 },
  down: { x: 0, y: -28 },
  left: { x: 28, y: 0 },
  right: { x: -28, y: 0 },
  none: { x: 0, y: 0 },
};

/**
 * Reveal one element when it scrolls into view.
 *
 * `once` defaults to true. Re-animating on every pass looks lively on a short
 * page and turns a long one into a flicker gallery as the user scrolls back up
 * past a dozen already-read sections.
 */
export function FadeIn({
  children,
  className,
  direction = "up",
  delay = 0,
  duration = 0.7,
  once = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  direction?: Dir;
  delay?: number;
  duration?: number;
  once?: boolean;
  as?: "div" | "section" | "li" | "span";
}) {
  const reduced = useReducedMotion();
  const M = motion[Tag];
  const from = offset[direction];

  if (reduced) return <Tag className={className}>{children}</Tag>;

  return (
    <M
      className={className}
      initial={{ opacity: 0, x: from.x, y: from.y }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount: 0.25, margin: "0px 0px -8% 0px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </M>
  );
}

/**
 * Parent that releases its children one after another.
 *
 * Pair with StaggerItem. The delay is per child rather than hand-written per
 * element so adding a card to a grid doesn't mean renumbering every delay after
 * it — a pattern the old hand-tuned `delay={i * 90}` call sites kept getting
 * wrong when the list changed.
 */
export function Stagger({
  children,
  className,
  step = 0.08,
  delay = 0,
  once = true,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  step?: number;
  delay?: number;
  once?: boolean;
  as?: "div" | "ul" | "section";
}) {
  const reduced = useReducedMotion();
  const M = motion[Tag];

  if (reduced) return <Tag className={className}>{children}</Tag>;

  return (
    <M
      className={className}
      initial="hidden"
      whileInView="shown"
      viewport={{ once, amount: 0.2, margin: "0px 0px -8% 0px" }}
      variants={{ shown: { transition: { staggerChildren: step, delayChildren: delay } } }}
    >
      {children}
    </M>
  );
}

export function StaggerItem({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
}) {
  const reduced = useReducedMotion();
  const M = motion[Tag];
  if (reduced) return <Tag className={className}>{children}</Tag>;
  return (
    <M className={className} variants={riseVariants}>
      {children}
    </M>
  );
}

/**
 * Card that leans toward the cursor.
 *
 * Deliberately shallow — 6 degrees, spring-damped. A steep tilt reads as a toy;
 * this reads as the surface having depth. Disabled outright under reduced
 * motion and never applied on touch, where there is no hover to justify it.
 */
export function Tilt({
  children,
  className,
  strength = 6,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 220, damping: 22 });
  const sy = useSpring(my, { stiffness: 220, damping: 22 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [strength, -strength]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-strength, strength]);

  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={cn("[transform-style:preserve-3d]", className)}
      style={{ rotateX, rotateY }}
      onPointerMove={(e) => {
        if (e.pointerType === "touch") return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        mx.set((e.clientX - r.left) / r.width - 0.5);
        my.set((e.clientY - r.top) / r.height - 0.5);
      }}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Count up to a number when it scrolls into view.
 *
 * Drives a text node imperatively rather than through React state: at 60fps a
 * setState per frame re-renders the whole section for two seconds, and several
 * of these run at once in the stats band.
 */
export function Counter({
  to,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });

  const format = (n: number) =>
    `${prefix}${n.toLocaleString("en-CA", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}${suffix}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || !inView) {
      if (reduced) el.textContent = format(to);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / (duration * 1000));
      // easeOutExpo: most of the distance early, then a long settle.
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = format(to * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, reduced, to, duration, prefix, suffix, decimals]);

  return (
    <span ref={ref} className={cn("tnum", className)}>
      {format(reduced ? to : 0)}
    </span>
  );
}
