import Link from "next/link";
import { ShieldCheck, FileCheck2, Repeat } from "lucide-react";
import { Logo } from "@/components/brand/logo";

const highlights = [
  { icon: FileCheck2, text: "CRA-compliant tax receipts, issued automatically" },
  { icon: Repeat, text: "Recurring giving with smart retry logic" },
  { icon: ShieldCheck, text: "PCI-DSS secure · Canadian data residency" },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Link href="/" aria-label="KindPath home" className="w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>

      {/* brand side */}
      <div className="relative hidden overflow-hidden bg-brand-gradient lg:block">
        <div
          aria-hidden
          className="absolute inset-0 bg-grid-faint opacity-10 [background-size:32px_32px]"
        />
        <div className="relative flex h-full flex-col justify-center px-14 text-white">
          <blockquote className="font-display text-3xl font-semibold leading-snug">
            “KindPath gave our parish back hours every week. Receipts just… happen now.”
          </blockquote>
          <p className="mt-4 text-white/80">— Finance Council, St. Mary&apos;s Parish</p>

          <ul className="mt-12 flex flex-col gap-4">
            {highlights.map((h) => (
              <li key={h.text} className="flex items-center gap-3 text-white/90">
                <span className="grid size-9 place-items-center rounded-lg bg-white/15">
                  <h.icon className="size-4" />
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
