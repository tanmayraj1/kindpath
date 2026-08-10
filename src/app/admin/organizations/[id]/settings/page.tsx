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
          <CardTitle>Payment gateway</CardTitle>
          <p className="text-sm text-muted-foreground">
            This organization&apos;s own gateway account, so donations settle directly to them.
            Encrypted at rest, and used in preference to the platform default for every charge and
            every payment page.
          </p>
        </CardHeader>
        <CardContent>
          <PosCredentialsForm
            orgId={org.id}
            configured={gateway.configured}
            provider={gateway.provider}
            error={gateway.error}
            midTail={gateway.midTail}
            email={gateway.email}
            wvNumber={gateway.wvNumber}
            termId={gateway.termId}
            keyTail={gateway.keyTail}
            liveMode={gateway.liveMode}
          />
        </CardContent>
      </Card>
    </div>
  );
}
