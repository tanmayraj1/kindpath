import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { DonationFlow } from "@/components/give/donation-flow";
import { Branded } from "@/components/give/branded";
import { getPublicOrg } from "@/lib/queries/public";
import { orgPaymentReadiness } from "@/lib/payments/hosted";
import { GivingClosed } from "@/components/give/giving-closed";
import { SimulatedGatewayBanner } from "@/components/give/simulated-banner";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const org = await getPublicOrg(params.slug);
  if (!org) return { title: "Donate" };

  // The link a charity shares is THEIR link, so the preview a donor sees in
  // WhatsApp, iMessage or Facebook has to be theirs too — not KindPath's
  // marketing card, which is what every giving link unfurled as before. The
  // image itself comes from ./opengraph-image.tsx in this folder.
  const title = `Give to ${org.name}`;
  const description =
    org.charityStatus === "registered"
      ? `Support ${org.name} with a secure online donation. Your official tax receipt is emailed automatically.`
      : `Support ${org.name} with a secure online donation. A confirmation is emailed to you.`;
  const url = `/give/${org.slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // Replaces the root openGraph object wholesale (Next merges metadata
    // shallowly), so the site-level fields are restated here.
    openGraph: {
      type: "website",
      siteName: `${org.name} on KindPath`,
      locale: "en_CA",
      url,
      title,
      description,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function GivePage({ params }: { params: { slug: string } }) {
  const org = await getPublicOrg(params.slug);
  if (!org) notFound();
  const readiness = await orgPaymentReadiness(org.id);

  return (
    <Branded color={org.primaryColor} className="relative min-h-screen overflow-hidden bg-secondary/40">
      <SimulatedGatewayBanner />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[40rem] -translate-x-1/2 rounded-full bg-brand-gradient opacity-20 blur-[120px]"
      />
      <header className="container flex h-16 items-center justify-between">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={org.name} className="h-9 w-auto max-w-[180px] object-contain" />
        ) : (
          <Logo />
        )}
        <Badge variant={org.charityStatus === "registered" ? "success" : "neutral"}>
          {org.charityStatus === "registered" ? "Registered charity" : "Donations"}
        </Badge>
      </header>

      <main className="container flex items-start justify-center py-10 sm:py-16">
        {readiness.status === "ready" ? (
          <DonationFlow org={org} hosted={readiness.hosted} />
        ) : (
          <GivingClosed orgName={org.name} />
        )}
      </main>
    </Branded>
  );
}
