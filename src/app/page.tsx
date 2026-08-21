import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { Hero } from "@/components/marketing/hero";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { Showcase } from "@/components/marketing/showcase";
import { UseCases } from "@/components/marketing/use-cases";
import { Journey } from "@/components/marketing/journey";
import { StatsBand } from "@/components/marketing/stats-band";
import { Features } from "@/components/marketing/features";
import { Pricing } from "@/components/marketing/pricing";
import { Faq } from "@/components/marketing/faq";
import { Cta } from "@/components/marketing/cta";

/**
 * Landing page.
 *
 * A note that outlived its original home, because it keeps being the thing that
 * matters most here: this page once presented four fabricated metrics as fact —
 * "300+ faith communities", "$12,000,000 raised", "480K tax receipts issued",
 * "99.9% uptime" — for a product with no customers. A charity's board can
 * reasonably rely on numbers like that when deciding where to send donor money.
 *
 * Two slots in this layout are the usual homes for exactly that kind of claim,
 * and both are deliberately filled with something else: TrustStrip names the
 * standards the product is written against instead of a wall of customer logos,
 * and StatsBand reports measured properties of the software instead of business
 * results. Anything added here later should clear the same bar — checkable, or
 * not stated.
 */
export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustStrip />
        <Showcase />
        <UseCases />
        <Journey />
        <StatsBand />
        <Features />
        <Pricing />
        <Faq />
        <Cta />
      </main>
      <SiteFooter />
    </div>
  );
}
