import Link from "next/link";
import { ShieldCheck, FileCheck2, Repeat, Landmark } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { OpenHands, Sunrise } from "@/components/brand/line-art";

const highlights = [
  { icon: FileCheck2, text: "CRA-compliant tax receipts, issued automatically" },
  { icon: Repeat, text: "Recurring giving with automatic retries" },
  {
    icon: ShieldCheck,
    text: "Card details never touch KindPath — payments run on your gateway's secure page",
  },
  { icon: Landmark, text: "Donations settle directly to your own merchant account" },
];

/**
 * Donor-surface auth shell: cream ground, white card, line-art above the form.
 *
 * The illustration sits on the FORM side, not only on the brand panel, because
 * the brand panel is hidden below lg — which is where most donors arrive, coming
 * from a receipt email on a phone. An illustration only the desktop half sees
 * isn't part of the design, it's decoration for the minority.
 *
 * Motion here is slower than the rest of the product (700ms, generous delays).
 * This audience skews older and lands on this page once, from an email — nothing
 * should feel hurried or flash past before it's read.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="surface-donor grid min-h-screen bg-background lg:grid-cols-2">
      {/* form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="KindPath home" className="w-fit">
          <Logo />
        </Link>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <OpenHands className="mx-auto mb-6 w-40 motion-safe:animate-rise-in sm:w-48" />
            <div
              className="rounded-card border border-border bg-card p-6 shadow-soft motion-safe:animate-rise-in sm:p-8"
              style={{ animationDelay: "120ms" }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* brand side */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:block">
        <div
          aria-hidden
          className="absolute inset-0 bg-grid-faint opacity-10 [background-size:32px_32px]"
        />
        <Sunrise
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 w-72 opacity-25"
        />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          {/* A statement we can stand behind — the previous testimonial here was
              invented and attributed to the demo-data organization, the same
              class of fabricated claim removed from the marketing page. */}
          <p className="font-display text-3xl font-semibold leading-snug">
            Every gift receipted.
            <br />
            Every record yours.
            <br />
            <span className="text-white/70">Built for Canadian charities.</span>
          </p>

          <ul className="mt-12 flex flex-col gap-4">
            {highlights.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
                  <h.icon className="size-4 stroke-[1.5]" aria-hidden />
                </span>
                <span className="text-sm">{h.text}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
