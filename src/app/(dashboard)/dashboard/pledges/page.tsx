import { HandHeart } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CreatePledgeForm } from "@/components/dashboard/create-pledge-form";
import { PledgeActions } from "@/components/dashboard/pledge-actions";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listPledges } from "@/lib/queries/pledges";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Pledges" };

const statusVariant: Record<string, "success" | "warning" | "neutral"> = {
  fulfilled: "success",
  open: "warning",
  cancelled: "neutral",
};

export default async function PledgesPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "campaigns");
  const { pledges, totals, campaigns } = await listPledges(session.orgId);

  return (
    <>
      <Topbar title="Pledges" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="p-5">
              <p className="font-display text-2xl font-bold text-warning-foreground">{formatCAD(totals.open, { maximumFractionDigits: 0 })}</p>
              <p className="text-sm text-muted-foreground">Outstanding pledged</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="font-display text-2xl font-bold text-success">{formatCAD(totals.fulfilled, { maximumFractionDigits: 0 })}</p>
              <p className="text-sm text-muted-foreground">Fulfilled</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Record a pledge</CardTitle>
            <p className="text-sm text-muted-foreground">
              Track commitments to give (e.g. at a gala or capital campaign). Mark them fulfilled when paid.
            </p>
          </CardHeader>
          <CardContent>
            <CreatePledgeForm campaigns={campaigns} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pledges ({pledges.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {pledges.length === 0 ? (
              <EmptyState icon={<HandHeart className="size-5" />} title="No pledges yet" body="Record your first pledge above." />
            ) : (
              <Table>
                <Thead>
                  <Th>Donor</Th>
                  <Th>Campaign</Th>
                  <Th>Due</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Manage</Th>
                </Thead>
                <tbody>
                  {pledges.map((p) => (
                    <Tr key={p.id}>
                      <Td>
                        <p className="font-medium">{p.donorName}</p>
                        {p.donorEmail && <p className="text-xs text-muted-foreground">{p.donorEmail}</p>}
                      </Td>
                      <Td className="text-muted-foreground">{p.campaign ?? "—"}</Td>
                      <Td className="text-muted-foreground">{p.dueDate ? new Date(p.dueDate).toLocaleDateString("en-CA") : "—"}</Td>
                      <Td className="text-right font-medium">{formatCAD(p.amount, { maximumFractionDigits: 0 })}</Td>
                      <Td className="text-right">
                        <Badge variant={statusVariant[p.status] ?? "neutral"} className="capitalize">{p.status}</Badge>
                      </Td>
                      <Td>
                        <PledgeActions id={p.id} status={p.status} />
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
}
