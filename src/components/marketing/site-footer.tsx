import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#pricing", label: "Pricing" },
      { href: "#how-it-works", label: "How it works" },
      { href: "/signup", label: "Start free trial" },
    ],
  },
  {
    title: "Compliance",
    links: [
      { href: "#", label: "CRA tax receipts" },
      { href: "#", label: "CASL & privacy" },
      { href: "#", label: "PCI-DSS" },
      { href: "#", label: "Data residency" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "#", label: "About" },
      { href: "#", label: "Contact" },
      { href: "#", label: "Terms" },
      { href: "#", label: "Privacy" },
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
          <p>Made in Canada 🇨🇦 · Hosted in Canadian data regions</p>
        </div>
      </div>
    </footer>
  );
}
