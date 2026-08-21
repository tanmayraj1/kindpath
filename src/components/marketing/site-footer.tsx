import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#pricing", label: "Pricing" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/signup", label: "Start free trial" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { href: "/privacy", label: "CASL & privacy" },
      { href: "/terms#your-responsibilities-as-a-registered-charity", label: "CRA tax receipts" },
      { href: "/privacy#where-your-information-is-stored", label: "Data residency" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/contact", label: "Contact" },
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/dpa", label: "Data processing" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Donation management built for Canadian faith communities. Automate giving,
              issue compliant tax receipts, and grow generosity.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h4 className="text-sm font-semibold text-foreground">{col.title}</h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} KindPath. All rights reserved.</p>
          <p>
            Made by{" "}
            <a
              href="https://rytfulmedia.in"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground transition-colors hover:text-brand-600"
            >
              Rytful Media
            </a>{" "}
            · Made in Canada 🇨🇦
          </p>
        </div>
      </div>

      {/* Oversized wordmark as a closing note. Clipped at the baseline so it
          reads as a watermark the page rests on rather than a heading, and
          aria-hidden because the accessible name is already on the logo link
          above — a screen reader reaching the end of the page should not hear
          "KindPath" a second time as if it were new content. */}
      <div aria-hidden className="relative mt-4 h-[9vw] min-h-[3.5rem] overflow-hidden select-none">
        <span className="pointer-events-none absolute inset-x-0 -top-[3.2vw] block bg-gradient-to-b from-brand-500/20 to-transparent bg-clip-text text-center font-display text-[15vw] font-extrabold leading-none tracking-tight text-transparent">
          KindPath
        </span>
      </div>
    </footer>
  );
}
