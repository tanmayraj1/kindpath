import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { CreateOrgForm } from "@/components/admin/create-org-form";
import { buttonVariants } from "@/components/ui/button";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listOrganizations } from "@/lib/queries/admin";
import { cn, formatCAD } from "@/lib/utils";

export const metadata = { title: "Organizations" };

export default async function OrganizationsPage() {
  const session = await requirePlatformAdmin();
  const orgs = await listOrganizations();

  return (
    <>
      <Topbar title="Organizations" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Add an organization</CardTitle>
            <p className="text-sm text-muted-foreground">
              Creates the org, its first admin account, a trial subscription, and a default fund.
            </p>
          </CardHeader>
          <CardContent>
            <CreateOrgForm />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All organizations ({orgs.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <Thead>
                <Th>Organization</Th>
                <Th>Type</Th>
                <Th>Plan</Th>
                <Th className="text-right">Donors</Th>
                <Th className="text-right">Raised</Th>
                <Th className="text-right">Status</Th>
                <Th className="text-right">Actions</Th>
              </Thead>
              <tbody>
                {orgs.map((o) => (
                  <Tr key={o.id}>
                    <Td>
                      <Link
                        href={`/admin/organizations/${o.id}`}
                        className="font-medium hover:text-brand-600"
                      >
                        {o.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">/give/{o.slug}</p>
                    </Td>
                    <Td>
                      <Badge variant={o.charityStatus === "registered" ? "success" : "neutral"}>
                        {o.charityStatus === "registered" ? "Registered" : "Non-registered"}
                      </Badge>
                    </Td>
                    <Td className="capitalize text-muted-foreground">{o.plan}</Td>
                    <Td className="text-right text-muted-foreground">{o.donors}</Td>
                    <Td className="text-right font-medium">
                      {formatCAD(o.raised, { maximumFractionDigits: 0 })}
                    </Td>
                    <Td className="text-right">
                      <Badge variant={o.status === "active" ? "success" : "warning"} className="capitalize">
                        {o.status}
                      </Badge>
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/admin/organizations/${o.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <Settings2 className="size-4" /> Manage
                      </Link>
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
