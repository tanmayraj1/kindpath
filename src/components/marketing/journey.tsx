"use client";

import { useEffect, useRef, useState } from "react";
import { HandCoins, MapPin, FileCheck2, Repeat } from "lucide-react";
import { Section, SectionHeading } from "@/components/ui/section";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: HandCoins,
    step: "01",
    title: "Donor gives",
    description:
      "From your branded page or QR code, a donor picks an amount, a fund, and one-time or recurring. Payment is securely tokenized.",
  },
  {
    icon: MapPin,
    step: "02",
    title: "They add their address",
    description:
      "Right after payment, the donor enters their name and address — exactly what the CRA requires on an official receipt.",
  },
  {
    icon: FileCheck2,
    step: "03",
    title: "Receipt is issued",
    description:
      "A serial-numbered, CRA-compliant PDF receipt is generated automatically, emailed instantly, and saved to their portal.",
  },
  {
    icon: Repeat,
    step: "04",
    title: "It keeps giving",
    description:
      "Recurring plans bill automatically with smart retries, and donors manage everything themselves from their dashboard.",
  },
];

export function Journey() {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh * 0.35;
      const passed = vh * 0.78 - rect.top;
      setProgress(Math.max(0, Math.min(1, passed / total)));
    };
    let ticking = false;
    const onScroll = () => {
      // update directly, but coalesce bursts with rAF when it's available
      if (typeof requestAnimationFrame === "undefined") {
        update();
        return;
      }
      if (ticking) return;
      ticking = true;
      raf = requestAnimationFrame(() => {
        ticking = false;
        update();
      });
      update(); // also run immediately so it works even if rAF is throttled
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const n = steps.length;

  return (
    <Section id="how-it-works" className="bg-secondary/40">
      <div className="container">
        <SectionHeading
          eyebrow="How it works"
          title="From donation to tax receipt — automatically"
          description="Follow the journey: the address step happens after payment, so giving is frictionless and every receipt is still fully compliant."
        />

        <div ref={ref} className="relative mx-auto mt-16 max-w-2xl">
          {/* track + animated fill */}
          <div className="absolute bottom-0 left-6 top-0 w-1 -translate-x-1/2 rounded-full bg-border" />
          <div
            className="absolute left-6 top-0 w-1 -translate-x-1/2 rounded-full bg-brand-gradient shadow-brand transition-[height] duration-150 ease-out"
            style={{ height: `${progress * 100}%` }}
          />

          <div className="flex flex-col gap-10 sm:gap-14">
            {steps.map((s, i) => {
              const active = progress >= (i + 0.5) / n;
              return (
                <div key={s.step} className="relative pl-16">
                  {/* node */}
                  <span
                    className={cn(
                      "absolute left-6 top-0 z-10 grid size-12 -translate-x-1/2 place-items-center rounded-2xl border-2 transition-all duration-500",
                      active
                        ? "scale-110 border-transparent bg-brand-gradient text-white shadow-brand"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    <s.icon className="size-5" />
                  </span>

                  {/* content */}
                  <div
                    className={cn(
                      "rounded-2xl border bg-card p-5 shadow-sm transition-all duration-500",
                      active
                        ? "translate-x-0 border-brand-200 opacity-100 shadow-md"
                        : "translate-x-2 border-border opacity-60"
                    )}
                  >
                    <span className="font-display text-xs font-bold tracking-widest text-brand-600">
                      STEP {s.step}
                    </span>
                    <h3 className="mt-1 font-display text-lg font-semibold">{s.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Section>
  );
}
