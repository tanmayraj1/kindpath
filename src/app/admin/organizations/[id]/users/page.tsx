import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import {
  InviteOrgUserButton,
  OrgUserRoleSelect,
  OrgUserStatusButton,
} from "@/components/admin/org-user-actions";
import { listOrgUsers } from "@/lib/queries/admin";

// Static rather than generateMetadata: the detail pages already load their
// record inside a withTenant transaction, and Prisma calls are not deduped
// across a second metadata pass — naming the row in the tab would cost every
// one of these pages a duplicate query. The section name is what actually
// fixes the defect: without it these 13 pages fell through to the root
// layout's marketing title, so every open tab read "KindPath — Donation
// management for faith communities" and none could be told apart.
export const metadata = { title: "Organization users" };

/**
 * Support's view of an organization's users.
 *
 * This had exactly one control — reset password — which meant an organization
 * that had locked itself out (its only admin disabled, or belonging to someone
 * who had left) could not be recovered by support at all. Inviting, promoting
 * and re-enabling are the three actions that make it recoverable.
 */
export default async function OrgUsers({ params }: { params: { id: string } }) {
  const users = await listOrgUsers(params.id);
  const activeAdmins = users.filter((u) => u.role === "org_admin" && u.status === "active").length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">
              {users.length} user{users.length === 1 ? "" : "s"}
            </p>
            {activeAdmins === 0 && users.length > 0 && (
              <p className="text-sm font-medium text-destructive">
                No active admin — this organization is locked out. Invite or re-enable one.
              </p>
            )}
          </div>
          <InviteOrgUserButton orgId={params.id} />
        </div>

        {users.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No users yet"
            body="Invite the organization's first admin so they can sign in and set up their account."
          />
        ) : (
          <Table>
            <Thead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
              <Th>Last login</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td>
                    <OrgUserRoleSelect userId={u.id} role={u.role} />
                  </Td>
                  <Td>
                    <Badge variant={u.status === "active" ? "success" : "neutral"} className="capitalize">
                      {u.status}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-CA") : "Never"}
                  </Td>
                  <Td>
                    <div className="flex flex-wrap items-start justify-end gap-2">
                      <OrgUserStatusButton userId={u.id} name={u.name} status={u.status} />
                      <ResetPasswordButton userId={u.id} email={u.email} />
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
