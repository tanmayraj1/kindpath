import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ManualDonationForm } from "@/components/dashboard/manual-donation-form";
import { requireOrgUser } from "@/lib/auth/guards";
import { listFunds } from "@/lib/queries/org";

export const metadata = { title: "Record a donation" };

export default async function NewDonationPage() {
  const session = await requireOrgUser();
  const funds = (await listFunds(session.orgId)).rows;
  const activeFunds = funds.filter((f) => f.isActive).map((f) => ({ id: f.id, name: f.name }));

  return (
    <>
      <Topbar title="Record a donation" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Manual / offline donation</CardTitle>
            <p className="text-sm text-muted-foreground">
              Log a cash, cheque, or offline gift. A receipt is issued automatically when an address is provided.
            </p>
          </CardHeader>
          <CardContent>
            <ManualDonationForm funds={activeFunds} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
