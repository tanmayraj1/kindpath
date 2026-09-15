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
  return { title: org ? `Give to ${org.name}` : "Donate" };
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
