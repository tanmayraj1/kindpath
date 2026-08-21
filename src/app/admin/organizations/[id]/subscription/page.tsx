import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionForm } from "@/components/admin/subscription-form";
import { getOrgManage } from "@/lib/queries/admin";

// Static rather than generateMetadata: the detail pages already load their
// record inside a withTenant transaction, and Prisma calls are not deduped
// across a second metadata pass — naming the row in the tab would cost every
// one of these pages a duplicate query. The section name is what actually
// fixes the defect: without it these 13 pages fell through to the root
// layout's marketing title, so every open tab read "KindPath — Donation
// management for faith communities" and none could be told apart.
export const metadata = { title: "Organization subscription" };

export default async function OrgSubscription({ params }: { params: { id: string } }) {
  const org = await getOrgManage(params.id);
  if (!org) notFound();

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Subscription &amp; access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Change the plan, override pricing, manage the trial, or grant/revoke access by setting the status.
          Setting status to <strong>Cancelled</strong> locks the org&apos;s admins out.
        </p>
      </CardHeader>
      <CardContent>
        <SubscriptionForm
          orgId={org.id}
          plan={org.subscription?.plan ?? "starter"}
          cycle={org.subscription?.cycle ?? "monthly"}
          price={org.subscription?.price ?? 29}
          status={org.subscription?.status ?? "trialing"}
        />
      </CardContent>
    </Card>
  );
}
