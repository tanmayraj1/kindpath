import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TwoFactorSetup } from "@/components/dashboard/two-factor-setup";
import { requireOrgUser } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";

export const metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requireOrgUser();
  const user = await withTenant(session.orgId, (tx) =>
    tx.orgUser.findUnique({ where: { id: session.sub }, select: { totpEnabledAt: true } })
  );

  return (
    <>
      <Topbar title="Security" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Two-factor authentication</CardTitle>
            <p className="text-sm text-muted-foreground">
              Protect your account with a time-based code in addition to your password.
            </p>
          </CardHeader>
          <CardContent>
            <TwoFactorSetup enabled={!!user?.totpEnabledAt} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
