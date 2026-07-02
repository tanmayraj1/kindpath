import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Cta() {
  return (
    <section className="py-20 sm:py-28">
      <div className="container">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-8 py-16 text-center shadow-brand sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-grid-faint opacity-10 [background-size:32px_32px]"
          />
          <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to grow generosity in your community?
            </h2>
            <p className="text-lg text-white/85">
              Join faith communities across Canada using KindPath to make giving effortless
              and compliant. Start your free 14-day trial today.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/signup"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "group bg-white text-brand-700 hover:bg-white/90"
                )}
              >
                Start free trial
                <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/contact"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/30 bg-transparent text-white hover:bg-white/10"
                )}
              >
                Book a demo
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
