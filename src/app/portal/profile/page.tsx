import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProfileForm } from "@/components/portal/profile-form";
import { requireDonor } from "@/lib/auth/guards";
import { getDonorProfile } from "@/lib/queries/donor";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const session = await requireDonor();
  const donor = await getDonorProfile(session.orgId, session.sub);

  return (
    <>
      <Topbar title="Profile" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            {/* Email stays fixed: it identifies the account and is the unique key
                for this donor within the organization. Name is now editable —
                it's what gets printed on a tax receipt. */}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email-readonly">Email</Label>
              <Input id="email-readonly" defaultValue={donor?.email ?? ""} disabled />
              <p className="text-xs text-muted-foreground">
                Your email identifies your account here. Contact the organization to change it.
              </p>
            </div>
            <ProfileForm
              firstName={donor?.firstName}
              lastName={donor?.lastName}
              phone={donor?.phone}
              addressLine1={donor?.addressLine1}
              city={donor?.city}
              province={donor?.province}
              postalCode={donor?.postalCode}
              emailMarketing={donor?.emailMarketingOptIn ?? false}
              smsMarketing={donor?.smsMarketingOptIn ?? false}
            />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
