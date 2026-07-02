import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrgDetailsForm } from "@/components/admin/org-details-form";
import { getOrgManage } from "@/lib/queries/admin";

export default async function OrgSettings({ params }: { params: { id: string } }) {
  const org = await getOrgManage(params.id);
  if (!org) notFound();

  return (
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
  );
}
