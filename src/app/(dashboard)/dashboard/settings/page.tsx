import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { LogoUploader } from "@/components/dashboard/logo-uploader";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrg } from "@/lib/queries/org";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireOrgUser();
  const org = await getOrg(session.orgId);

  return (
    <>
      <Topbar title="Settings" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Branding</CardTitle>
            <p className="text-sm text-muted-foreground">
              Your logo and colour on your public pages, receipts and emails.
            </p>
          </CardHeader>
          <CardContent>
            <LogoUploader logoUrl={org?.logoUrl} />
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Organization &amp; receipts</CardTitle>
            <p className="text-sm text-muted-foreground">
              These details appear on every tax receipt you issue.
            </p>
          </CardHeader>
          <CardContent>
            <SettingsForm
              name={org?.name ?? ""}
              charityStatus={(org?.charityStatus as "registered" | "non_registered") ?? "non_registered"}
              craRegistrationNumber={org?.craRegistrationNumber}
              authorizedSignatory={org?.authorizedSignatory}
              receiptLocality={org?.receiptLocality}
              primaryColor={org?.primaryColor}
              receiptMessage={org?.receiptMessage}
              receiptFooter={org?.receiptFooter}
              receiptPrefix={org?.receiptPrefix}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
