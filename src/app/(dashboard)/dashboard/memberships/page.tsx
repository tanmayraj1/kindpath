import { Users2, ExternalLink } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { CreateMembershipForm } from "@/components/dashboard/create-membership-form";
import { requireOrgUser } from "@/lib/auth/guards";
import { assertFeature } from "@/lib/access";
import { listMembershipPlans, listMembers } from "@/lib/queries/memberships";
import { getOrg } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Memberships" };

const per: Record<string, string> = { weekly: "/wk", monthly: "/mo", quarterly: "/qtr", annual: "/yr" };
const statusVariant: Record<string, "success" | "warning" | "neutral" | "destructive"> = {
  active: "success",
  paused: "warning",
  cancelled: "neutral",
  suspended: "destructive",
};

export default async function MembershipsPage() {
  const session = await requireOrgUser();
  await assertFeature(session.orgId, "memberships");
  const [plans, members, org] = await Promise.all([
    listMembershipPlans(session.orgId),
    listMembers(session.orgId),
    getOrg(session.orgId),
  ]);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const joinUrl = `${appUrl}/join/${org?.slug}`;

  return (
    <>
      <Topbar title="Memberships" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Membership plans</CardTitle>
              <p className="text-sm text-muted-foreground">
                Members enroll and are billed automatically on your recurring engine.
              </p>
            </div>
            {plans.length > 0 && (
              <a href={joinUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
                Public join page <ExternalLink className="size-3.5" />
              </a>
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <CreateMembershipForm />
            {plans.length > 0 && (
              <Table>
                <Thead>
                  <Th>Plan</Th>
                  <Th>Billing</Th>
                  <Th className="text-right">Price</Th>
                  <Th className="text-right">Members</Th>
                  <Th className="text-right">Status</Th>
                </Thead>
                <tbody>
                  {plans.map((p) => (
                    <Tr key={p.id}>
                      <Td className="font-medium">{p.name}</Td>
                      <Td className="capitalize text-muted-foreground">{p.frequency}</Td>
                      <Td className="text-right font-medium">
                        {formatCAD(p.amount, { maximumFractionDigits: 0 })}
                        <span className="text-xs text-muted-foreground">{per[p.frequency] ?? ""}</span>
                      </Td>
                      <Td className="text-right text-muted-foreground">{p.members}</Td>
                      <Td className="text-right">
                        <Badge variant={p.isActive ? "success" : "neutral"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <EmptyState icon={<Users2 className="size-5" />} title="No members yet" body="Share your join page to enroll members." />
            ) : (
              <Table>
                <Thead>
                  <Th>Member</Th>
                  <Th>Plan</Th>
                  <Th>Since</Th>
                  <Th>Next billing</Th>
                  <Th className="text-right">Amount</Th>
                  <Th className="text-right">Status</Th>
                </Thead>
                <tbody>
                  {members.map((m) => (
                    <Tr key={m.id}>
                      <Td className="font-medium">{m.member}</Td>
                      <Td className="text-muted-foreground">{m.plan}</Td>
                      <Td className="text-muted-foreground">{new Date(m.since).toLocaleDateString("en-CA")}</Td>
                      <Td className="text-muted-foreground">
                        {m.nextBillingDate ? new Date(m.nextBillingDate).toLocaleDateString("en-CA") : "—"}
                      </Td>
                      <Td className="text-right font-medium">{formatCAD(m.amount, { maximumFractionDigits: 0 })}</Td>
                      <Td className="text-right">
                        <Badge variant={statusVariant[m.status] ?? "neutral"} className="capitalize">{m.status}</Badge>
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
