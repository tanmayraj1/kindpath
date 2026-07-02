"use client";

import { useState } from "react";
import { FileCheck2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCAD } from "@/lib/utils";

const PRESETS = [25, 50, 100, 250];
const FUNDS = ["General", "Building", "Missions"];

export function HeroPreview() {
  const [amount, setAmount] = useState(50);
  const [fund, setFund] = useState("General");
  const [bump, setBump] = useState(0);

  // a deterministic-looking receipt serial that changes with each interaction
  const serial = `2026-${String(480 + bump).padStart(6, "0")}`;

  function pick(a: number) {
    setAmount(a);
    setBump((b) => b + 1);
  }

  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="relative rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-brand-50 font-display font-bold text-brand-700">
              ST
            </span>
            <div>
              <p className="text-sm font-semibold">St. Mary&apos;s Parish</p>
              <p className="text-xs text-muted-foreground">Branded donation page</p>
            </div>
          </div>
          <span className="relative inline-flex">
            <Badge variant="success">Live</Badge>
            <span className="absolute -right-1 -top-1 size-2 rounded-full bg-success motion-safe:animate-pulse-ring" />
          </span>
        </div>

        <div className="mt-6 rounded-xl bg-secondary/60 p-4">
          <p className="text-xs font-medium text-muted-foreground">Donation amount</p>
          <p
            key={amount}
            className="font-display text-3xl font-bold motion-safe:animate-fade-in-up"
          >
            {formatCAD(amount, { maximumFractionDigits: 0 })}
          </p>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => pick(p)}
                className={cn(
                  "rounded-lg px-1 py-1.5 text-xs font-semibold transition-all active:scale-95",
                  amount === p
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "border border-border bg-background text-muted-foreground hover:border-brand-300"
                )}
              >
                ${p}
              </button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            {FUNDS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setFund(f);
                  setBump((b) => b + 1);
                }}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  fund === f
                    ? "bg-accent text-accent-foreground"
                    : "border border-border bg-background text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between rounded-xl border border-success/20 bg-success/5 p-4">
          <div className="flex items-center gap-3">
            <FileCheck2 className="size-5 text-success" />
            <div>
              <p key={serial} className="text-sm font-semibold motion-safe:animate-fade-in-up">
                Receipt #{serial}
              </p>
              <p className="text-xs text-muted-foreground">{fund} fund · emailed automatically</p>
            </div>
          </div>
          <Badge variant="success">Sent</Badge>
        </div>
      </div>

      {/* floating stat */}
      <div className="absolute -bottom-6 -left-6 hidden rounded-xl border border-border bg-card p-4 shadow-lg motion-safe:animate-float sm:block">
        <p className="text-xs text-muted-foreground">Raised this month</p>
        <p className="font-display text-xl font-bold text-success">{formatCAD(48250)}</p>
      </div>
      <div className="absolute -right-4 -top-4 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-lg motion-safe:animate-float-slow sm:block">
        <p className="text-xs font-medium">+12.4% MoM 📈</p>
      </div>
    </div>
  );
}
