import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ResetPasswordButton } from "@/components/admin/reset-password-button";
import { listOrgUsers } from "@/lib/queries/admin";

export default async function OrgUsers({ params }: { params: { id: string } }) {
  const users = await listOrgUsers(params.id);
  return (
    <Card>
      <CardContent className="p-6">
        {users.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No users.</p>
        ) : (
          <Table>
            <Thead>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Last login</Th>
              <Th className="text-right">Actions</Th>
            </Thead>
            <tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td className="font-medium">{u.name}</Td>
                  <Td className="text-muted-foreground">{u.email}</Td>
                  <Td>
                    <Badge variant="neutral" className="capitalize">
                      {u.role.replace("_", " ")}
                    </Badge>
                  </Td>
                  <Td className="text-muted-foreground">
                    {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("en-CA") : "Never"}
                  </Td>
                  <Td className="text-right">
                    <ResetPasswordButton userId={u.id} />
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
