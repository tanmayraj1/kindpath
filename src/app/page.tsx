import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Journey } from "@/components/marketing/journey";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Claims we can actually stand behind.
 *
 * This band previously presented four fabricated metrics as fact — "300+ faith
 * communities", "$12,000,000 raised", "480K tax receipts issued", "99.9%
 * uptime" — for a product with no customers yet. Beyond being untrue, inventing
 * an uptime figure and a donation volume is the kind of claim a charity's board
 * would reasonably rely on when choosing where to send donor money.
 *
 * These are properties of the software instead, each verifiable in this repo.
 */
const capabilities = [
  {
    label: "CRA-compliant receipts",
    detail: "Every required field, gap-free serial numbers, split receipting for advantages.",
  },
  {
    label: "Isolated by the database",
    detail: "PostgreSQL row-level security, verified against the catalog before every deploy.",
  },
  {
    label: "Your gateway, your money",
    detail: "Donations settle directly to your own merchant account. We never hold donor funds.",
  },
  {
    label: "Built for Canada",
    detail: "PIPEDA and Quebec Law 25 data rights, CASL consent tracking, GST/HST by province.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />

        {/* what the software actually guarantees */}
        <section className="border-y border-border bg-secondary/40">
          <div className="container grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
            {capabilities.map((item, i) => (
              <Reveal key={item.label} variant="up" delay={i * 90}>
                <p className="font-display text-base font-bold text-brand-600">{item.label}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{item.detail}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <Features />
        <Journey />
        <Reveal once>
          <Pricing />
        </Reveal>
        <Reveal once>
          <Faq />
        </Reveal>
        <Reveal once>
          <Cta />
        </Reveal>
      </main>
      <SiteFooter />
    </div>
  );
}
