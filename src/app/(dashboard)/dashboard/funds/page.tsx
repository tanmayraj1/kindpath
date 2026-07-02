import { Landmark } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateFundForm } from "@/components/dashboard/create-fund-form";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listFunds } from "@/lib/queries/org";

export const metadata = { title: "Funds" };

export default async function FundsPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "funds");
  const funds = await listFunds(session.orgId);

  return (
    <>
      <Topbar title="Funds" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Add a fund</CardTitle>
            <p className="text-sm text-muted-foreground">
              Funds let donors direct their gift — e.g. General, Building, Zakat, Sadaqah, Seva, Missions.
            </p>
          </CardHeader>
          <CardContent>
            <CreateFundForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All funds</CardTitle>
          </CardHeader>
          <CardContent>
            {funds.length === 0 ? (
              <EmptyState
                icon={<Landmark className="size-5" />}
                title="No funds yet"
                body="Create your first fund above to let donors choose where their gift goes."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Fund</Th>
                  <Th>Code</Th>
                  <Th className="text-right">Donations</Th>
                  <Th className="text-right">Status</Th>
                </Thead>
                <tbody>
                  {funds.map((f) => (
                    <Tr key={f.id}>
                      <Td className="font-medium">{f.name}</Td>
                      <Td className="text-muted-foreground">{f.code ?? "—"}</Td>
                      <Td className="text-right text-muted-foreground">{f.donationCount}</Td>
                      <Td className="text-right">
                        <Badge variant={f.isActive ? "success" : "neutral"}>
                          {f.isActive ? "Active" : "Inactive"}
                        </Badge>
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
