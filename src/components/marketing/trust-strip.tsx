"use client";

import { useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  Landmark,
  Lock,
  FileCheck2,
  Database,
  MapPin,
  CreditCard,
  Scale,
} from "lucide-react";

/**
 * What KindPath is built to satisfy — a scrolling marquee of the standards and
 * rails the product answers to.
 *
 * The design this follows puts a customer-logo wall here ("Trusted by 1,000+
 * happy clients"). KindPath has no customers yet, and this file's neighbours
 * carry an explicit note about fabricated metrics having been removed once
 * already, so a row of invented logos is the exact mistake this codebase has
 * decided not to repeat. Naming the frameworks the product is actually written
 * against does the same job for a buyer — a treasurer scanning for "is this
 * legitimate in Canada" — without asserting anything untrue.
 *
 * Every item is verifiable in this repo: CRA receipting rules, PIPEDA and Law 25
 * data rights, CASL consent, PostgreSQL row-level security, tokenized gateway
 * payments.
 */
const standards = [
  { icon: FileCheck2, label: "CRA receipting rules" },
  { icon: MapPin, label: "Quebec Law 25" },
  { icon: Scale, label: "PIPEDA data rights" },
  { icon: ShieldCheck, label: "CASL consent" },
  { icon: Database, label: "PostgreSQL row-level security" },
  { icon: CreditCard, label: "Tokenized payments" },
  { icon: Lock, label: "Encrypted credentials" },
  { icon: Landmark, label: "Direct merchant settlement" },
];

export function TrustStrip() {
  const reduced = useReducedMotion();
  // Two identical passes sit end to end so the -50% translate lands exactly on a
  // seam. Duplicating in markup rather than cloning in JS keeps this a pure CSS
  // animation with nothing running on the main thread.
  const track = [...standards, ...standards];

  return (
    <section className="border-y border-border bg-secondary/40 py-8">
      <div className="container">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Built to satisfy
        </p>
      </div>

      <div
        className="group relative mt-6 overflow-hidden"
        // Fade both ends so items enter and leave instead of being cut off.
        style={{
          maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div
          className={
            reduced
              ? "flex w-full flex-wrap justify-center gap-x-8 gap-y-3 px-6"
              : "flex w-max gap-8 motion-safe:animate-marquee group-hover:[animation-play-state:paused]"
          }
        >
          {(reduced ? standards : track).map((item, i) => (
            <span
              key={`${item.label}-${i}`}
              className="flex shrink-0 items-center gap-2 text-sm font-medium text-muted-foreground"
            >
              <item.icon className="size-4 text-brand-500" aria-hidden />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
