"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts up to `value` when scrolled into view, and resets when it leaves so it
 * replays on the way back. Formatting is configured with SERIALIZABLE props
 * (not a function) so it can be used directly from server components.
 */
export function CountUp({
  value,
  durationMs = 1300,
  prefix = "",
  suffix = "",
  decimals = 0,
  compactCurrency = false,
  className,
}: {
  value: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  compactCurrency?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const run = () => {
      if (reduce) {
        setDisplay(value);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
        setDisplay(value * eased);
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) run();
        else {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          setDisplay(0);
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const text = compactCurrency
    ? new Intl.NumberFormat("en-CA", {
        style: "currency",
        currency: "CAD",
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(display)
    : `${prefix}${display.toLocaleString("en-CA", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix}`;

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
