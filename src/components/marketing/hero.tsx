import Link from "next/link";
import { ArrowRight, ShieldCheck, FileCheck2, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HeroPreview } from "./hero-preview";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* ambient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-grid-faint opacity-[0.4] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[120px]"
      />

      <div className="container grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:gap-8">
        {/* copy */}
        <div className="flex flex-col items-start gap-6 animate-fade-in-up">
          <Badge variant="brand" className="px-3 py-1">
            <ShieldCheck className="size-3.5" />
            CRA-compliant · PCI-DSS · Made in Canada
          </Badge>
          <h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            Modern giving for{" "}
            <span className="text-gradient">temples, churches &amp; mosques</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
            KindPath helps your faith community collect one-time and recurring donations,
            automatically issue CRA-compliant tax receipts, and manage donors — all from one
            beautiful, branded platform.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "group")}>
              Start your free trial
              <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how-it-works"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              See how it works
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-success" /> Automated tax receipts
            </span>
            <span className="flex items-center gap-2">
              <Repeat className="size-4 text-success" /> Recurring giving
            </span>
            <span className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" /> No setup fees
            </span>
          </div>
        </div>

        {/* product preview card */}
        <div className="relative animate-fade-in-up [animation-delay:120ms]">
          <HeroPreview />
        </div>
      </div>
    </section>
  );
}
