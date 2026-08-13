import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch, Pagination } from "@/components/ui/list-controls";
import { parsePageParams } from "@/lib/pagination";
import { listDonors } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

export default async function OrgDonors({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { page?: string; q?: string; size?: string };
}) {
  // `q` was parsed and passed to the query, but no search box was ever rendered —
  // support could search this list only by hand-editing the URL.
  const pageParams = parsePageParams(searchParams);
  const donors = await listDonors(params.id, pageParams);
  const basePath = `/admin/organizations/${params.id}/donors`;
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <ListSearch action={basePath} q={pageParams.q} placeholder="Name or email…" label="Search donors" />
        {donors.rows.length === 0 ? (
          <EmptyState
            title={pageParams.q ? "No donors match that search" : "No donors yet"}
            body={
              pageParams.q
                ? "Try a different name or email address."
                : "Donors appear here once this organization starts receiving gifts."
            }
          />
        ) : (
          <Table>
            <Thead>
              <Th>Donor</Th>
              <Th>Email</Th>
              <Th>Giving</Th>
              <Th className="text-right">Total given</Th>
              <Th className="text-right">Receipt info</Th>
            </Thead>
            <tbody>
              {donors.rows.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-muted-foreground">{d.email}</Td>
                  <Td>
                    <Badge variant={d.recurring ? "brand" : "neutral"}>
                      {d.recurring ? "Recurring" : "One-time"}
                    </Badge>
                  </Td>
                  <Td className="text-right font-medium">
                    {formatCAD(d.totalGiven, { maximumFractionDigits: 0 })}
                  </Td>
                  <Td className="text-right">
                    <Badge variant={d.addressComplete ? "success" : "warning"}>
                      {d.addressComplete ? "Complete" : "Pending"}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="mt-4">
          <Pagination
            basePath={`/admin/organizations/${params.id}/donors`}
            data={donors}
            noun="donors"
          />
        </div>
      </CardContent>
    </Card>
  );
}
