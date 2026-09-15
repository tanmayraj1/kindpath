import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Branded } from "@/components/give/branded";
import { MembershipJoin } from "@/components/give/membership-join";
import { orgPaymentReadiness } from "@/lib/payments/hosted";
import { GivingClosed } from "@/components/give/giving-closed";
import { getPublicMembership } from "@/lib/queries/memberships";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const data = await getPublicMembership(params.slug);
  return { title: data ? `Join ${data.org.name}` : "Join" };
}

export default async function JoinPage({ params }: { params: { slug: string } }) {
  const data = await getPublicMembership(params.slug);
  if (!data || data.plans.length === 0) notFound();
  const { org, plans } = data;

  const readiness = await orgPaymentReadiness(org.id);

  return (
    <Branded color={org.primaryColor} className="relative min-h-screen overflow-hidden bg-secondary/40">
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
        <Badge variant="brand">Membership</Badge>
      </header>
      <main className="container flex items-start justify-center py-10 sm:py-16">
        {readiness.status === "ready" ? (
          <MembershipJoin
            org={{ name: org.name, slug: org.slug }}
            plans={plans}
            hosted={readiness.hosted}
          />
        ) : (
          <GivingClosed orgName={org.name} what="memberships" />
        )}
      </main>
    </Branded>
  );
}
