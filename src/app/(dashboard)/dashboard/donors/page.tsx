import Link from "next/link";
import { Users } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgUser } from "@/lib/auth/guards";
import { listDonors } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Donors" };

export default async function DonorsPage() {
  const session = await requireOrgUser();
  const donors = await listDonors(session.orgId);

  return (
    <>
      <Topbar title="Donors" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {donors.length} {donors.length === 1 ? "donor" : "donors"}
          </p>
        </div>
        <Card>
          <CardContent className="p-6">
            {donors.length === 0 ? (
              <EmptyState
                icon={<Users className="size-5" />}
                title="No donors yet"
                body="Donors appear here automatically when they give through your donation page."
              />
            ) : (
              <Table>
                <Thead>
                  <Th>Donor</Th>
                  <Th>Email</Th>
                  <Th>Giving</Th>
                  <Th className="text-right">Total given</Th>
                  <Th className="text-right">Receipt info</Th>
                  <Th className="text-right">Consent</Th>
                </Thead>
                <tbody>
                  {donors.map((d) => (
                    <Tr key={d.id} className="cursor-pointer hover:bg-secondary/40">
                      <Td>
                        <Link href={`/dashboard/donors/${d.id}`} className="flex items-center gap-3">
                          <span className="grid size-8 place-items-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                            {d.name.split(" ").map((n) => n[0]).join("")}
                          </span>
                          <span className="font-medium hover:text-brand-600">{d.name}</span>
                        </Link>
                      </Td>
                      <Td className="text-muted-foreground">{d.email}</Td>
                      <Td>
                        {d.recurring ? (
                          <Badge variant="brand">Recurring</Badge>
                        ) : (
                          <Badge variant="neutral">One-time</Badge>
                        )}
                      </Td>
                      <Td className="text-right font-medium">
                        {formatCAD(d.totalGiven, { maximumFractionDigits: 0 })}
                      </Td>
                      <Td className="text-right">
                        {d.addressComplete ? (
                          <Badge variant="success">Complete</Badge>
                        ) : (
                          <Badge variant="warning">Address pending</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Badge variant={d.casl === "none" ? "outline" : "neutral"} className="capitalize">
                          {d.casl}
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
