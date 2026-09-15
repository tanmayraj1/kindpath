import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicOrg } from "@/lib/queries/public";
import { getOrgAccess } from "@/lib/access";
import { orgPaymentReadiness } from "@/lib/payments/hosted";
import { GivingClosed } from "@/components/give/giving-closed";
import { Branded } from "@/components/give/branded";
import { KioskFlow } from "@/components/give/kiosk-flow";

export const metadata: Metadata = { title: "Give", robots: { index: false } };

/**
 * Full-screen self-serve kiosk giving page for tablets at in-person events.
 * Gated by the same "qr" feature as QR/kiosk giving. No nav chrome, auto-resets.
 */
export default async function KioskPage({ params }: { params: { slug: string } }) {
  const org = await getPublicOrg(params.slug);
  if (!org) notFound();

  // Same entitlement as QR/kiosk giving.
  const { features } = await getOrgAccess(org.id);
  if (!features.qr) notFound();

  const readiness = await orgPaymentReadiness(org.id);
  if (readiness.status !== "ready") {
    return (
      <Branded color={org.primaryColor} className="flex min-h-dvh items-center justify-center bg-secondary/30 p-6">
        <GivingClosed orgName={org.name} />
      </Branded>
    );
  }
  const hosted = readiness.hosted;

  return (
    <Branded color={org.primaryColor} className="min-h-dvh bg-secondary/30">
      <KioskFlow
        org={{
          name: org.name,
          slug: org.slug,
          charityStatus: org.charityStatus as "registered" | "non_registered",
          funds: org.funds,
        }}
        hosted={hosted}
      />
    </Branded>
  );
}
