import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgDetailsForm } from "@/components/admin/org-details-form";
import { PosCredentialsForm } from "@/components/admin/pos-credentials-form";
import { getOrgManage } from "@/lib/queries/admin";
import { describeOrgGatewayCredentials } from "@/lib/payments/org-credentials";

export default async function OrgSettings({ params }: { params: { id: string } }) {
  const org = await getOrgManage(params.id);
  if (!org) notFound();
  const gateway = await describeOrgGatewayCredentials(org.id);

  return (
    <div className="flex flex-col gap-6">
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
          <p className="text-sm text-muted-foreground">
            These details appear on the institution&apos;s receipts. Edits here apply immediately.
          </p>
        </CardHeader>
        <CardContent>
          <OrgDetailsForm
            orgId={org.id}
            name={org.name}
            charityStatus={org.charityStatus as "registered" | "non_registered"}
            craRegistrationNumber={org.craRegistrationNumber}
            authorizedSignatory={org.authorizedSignatory}
            receiptLocality={org.receiptLocality}
          />
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Payment gateway (WeVend merchant)</CardTitle>
          <p className="text-sm text-muted-foreground">
            This organization&apos;s own WeVend merchant account. Encrypted at rest; takes effect
            when the platform runs with PAYMENT_PROVIDER=wevend.
          </p>
        </CardHeader>
        <CardContent>
          <PosCredentialsForm
            orgId={org.id}
            configured={gateway.configured}
            midTail={gateway.midTail}
            email={gateway.email}
            termId={gateway.termId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
