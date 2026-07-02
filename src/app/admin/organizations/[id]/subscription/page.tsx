import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriptionForm } from "@/components/admin/subscription-form";
import { getOrgManage } from "@/lib/queries/admin";

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
