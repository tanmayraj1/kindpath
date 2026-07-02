import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { Features } from "@/components/marketing/features";
import { Journey } from "@/components/marketing/journey";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";
import { Reveal } from "@/components/marketing/reveal";
import { CountUp } from "@/components/marketing/count-up";

const stats = [
  { label: "Faith communities", value: 300, suffix: "+" },
  { label: "Raised through KindPath", value: 12_000_000, compactCurrency: true },
  { label: "Tax receipts issued", value: 480, suffix: "K" },
  { label: "Uptime", value: 99.9, decimals: 1, suffix: "%" },
] as const;

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />

        {/* trust / stats band */}
        <section className="border-y border-border bg-secondary/40">
          <div className="container grid grid-cols-2 gap-8 py-12 lg:grid-cols-4">
            {stats.map((stat, i) => (
              <Reveal key={stat.label} variant="up" delay={i * 90} className="text-center">
                <p className="font-display text-3xl font-extrabold text-brand-600 sm:text-4xl">
                  <CountUp
                    value={stat.value}
                    suffix={"suffix" in stat ? stat.suffix : ""}
                    decimals={"decimals" in stat ? stat.decimals : 0}
                    compactCurrency={"compactCurrency" in stat ? stat.compactCurrency : false}
                  />
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
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
