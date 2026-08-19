import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { ListSearch, Pagination } from "@/components/ui/list-controls";
import { listFunds } from "@/lib/queries/org";
import { parsePageParams, paged } from "@/lib/pagination";

export default async function OrgFunds({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { page?: string; q?: string; size?: string };
}) {
  // This tab loaded every fund with no search — the one list the scale pass
  // missed when the rest of God Mode was paginated.
  const p = parsePageParams(searchParams);
  const { rows, total } = await listFunds(params.id, p);
  const data = paged(rows, total, p);
  const basePath = `/admin/organizations/${params.id}/funds`;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <ListSearch action={basePath} q={p.q} placeholder="Fund name or code…" label="Search funds" />
        {rows.length === 0 ? (
          <EmptyState
            title={p.q ? "No funds match that search" : "No funds defined"}
            body={
              p.q
                ? "Try a different name or code."
                : "This organization hasn't set up any funds for donors to designate gifts to."
            }
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
              {rows.map((f) => (
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
        <Pagination basePath={basePath} data={data} noun="funds" />
      </CardContent>
    </Card>
  );
}
