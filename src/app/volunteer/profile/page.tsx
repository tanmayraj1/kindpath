import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireVolunteer } from "@/lib/auth/guards";
import { getVolunteer } from "@/lib/queries/volunteers";
import { ChangePasswordForm } from "@/components/volunteer/change-password-form";

export const metadata = { title: "Profile" };

export default async function VolunteerProfilePage() {
  const session = await requireVolunteer();
  const me = await getVolunteer(session.orgId, session.sub);

  return (
    <>
      <Topbar title="Profile" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Name</dt>
              <dd>
                {me?.firstName} {me?.lastName}
              </dd>
              <dt className="text-muted-foreground">Email</dt>
              <dd>{me?.email}</dd>
              {me?.phone && (
                <>
                  <dt className="text-muted-foreground">Phone</dt>
                  <dd>{me.phone}</dd>
                </>
              )}
              {me?.role && (
                <>
                  <dt className="text-muted-foreground">Role</dt>
                  <dd>{me.role}</dd>
                </>
              )}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              To update these details, contact your organization&apos;s office.
            </p>
          </CardContent>
        </Card>

        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Change password</CardTitle>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
