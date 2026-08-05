import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { InviteTeamForm } from "@/components/dashboard/invite-team-form";
import { TeamActions } from "@/components/dashboard/team-actions";
import { requireOrgAdmin } from "@/lib/auth/guards";
import { listTeamMembers } from "@/lib/queries/org";

export const metadata = { title: "Team" };

const roleLabel: Record<string, string> = {
  org_admin: "Admin",
  signatory: "Signatory",
  staff: "Staff",
};

export default async function TeamPage() {
  const session = await requireOrgAdmin();
  const members = await listTeamMembers(session.orgId);

  return (
    <>
      <Topbar title="Team" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Invite a teammate</CardTitle>
            <p className="text-sm text-muted-foreground">
              Admins manage everything; signatories appear on receipts; staff have limited access.
            </p>
          </CardHeader>
          <CardContent>
            <InviteTeamForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <Thead>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Role</Th>
                <Th>Last login</Th>
                <Th className="text-right">Status</Th>
                <Th className="text-right">Manage</Th>
              </Thead>
              <tbody>
                {members.map((m) => (
                  <Tr key={m.id}>
                    <Td className="font-medium">{m.name}</Td>
                    <Td className="text-muted-foreground">{m.email}</Td>
                    <Td>
                      <Badge variant="neutral">{roleLabel[m.role] ?? m.role}</Badge>
                    </Td>
                    <Td className="text-muted-foreground">
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString("en-CA") : "Never"}
                    </Td>
                    <Td className="text-right">
                      <Badge variant={m.status === "active" ? "success" : "neutral"} className="capitalize">
                        {m.status}
                      </Badge>
                    </Td>
                    <Td>
                      <TeamActions
                        userId={m.id}
                        email={m.email}
                        role={m.role}
                        status={m.status}
                        isSelf={m.id === session.sub}
                      />
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
