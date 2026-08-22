import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SettingsForm } from "@/components/dashboard/settings-form";
import { LogoUploader } from "@/components/dashboard/logo-uploader";
import { GatewayForm } from "@/components/dashboard/gateway-form";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrg } from "@/lib/queries/org";
import { describeOrgGatewayCredentials } from "@/lib/payments/org-credentials";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requireOrgUser();
  const [org, gateway] = await Promise.all([
    getOrg(session.orgId),
    describeOrgGatewayCredentials(session.orgId),
  ]);

  return (
    <>
      <Topbar title="Settings" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        {/* First, deliberately. Branding is cosmetic; this decides whether the
            org can receive money at all — and until now there was no org-facing
            way to set it. */}
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Payments</CardTitle>
            <p className="text-sm text-muted-foreground">
              Where your donations settle. Connect your own gateway so money reaches your
              account directly — KindPath never holds it.
            </p>
          </CardHeader>
          <CardContent>
            <GatewayForm summary={gateway} />
          </CardContent>
        </Card>

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
              receiptMode={(org?.receiptMode as "per_gift" | "annual" | "both") ?? "per_gift"}
              minReceiptAmount={Number(org?.minReceiptAmount ?? 0)}
              province={org?.province}
              addressLine1={org?.addressLine1}
              city={org?.city}
              postalCode={org?.postalCode}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
