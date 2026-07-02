"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Variant = "up" | "down" | "left" | "right" | "scale" | "fade";

const hidden: Record<Variant, string> = {
  up: "translate-y-10 opacity-0",
  down: "-translate-y-10 opacity-0",
  left: "translate-x-10 opacity-0",
  right: "-translate-x-10 opacity-0",
  scale: "scale-95 opacity-0",
  fade: "opacity-0",
};

/**
 * Scroll-triggered reveal that re-animates on BOTH scroll directions: it shows
 * when it enters the viewport and resets when it leaves, so scrolling up/down
 * replays the motion. Honors prefers-reduced-motion.
 */
export function Reveal({
  children,
  className,
  variant = "up",
  delay = 0,
  once = false,
}: {
  children: React.ReactNode;
  className?: string;
  variant?: Variant;
  delay?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          if (once) io.disconnect();
        } else if (!once) {
          setShown(false);
        }
      },
      { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once]);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={cn(
        "transition-all duration-700 ease-out will-change-transform motion-reduce:transition-none motion-reduce:transform-none",
        shown ? "translate-x-0 translate-y-0 scale-100 opacity-100" : hidden[variant],
        className
      )}
    >
      {children}
    </div>
  );
}
