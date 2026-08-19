import { ScrollText } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ListSearch, ListFilters, Pagination } from "@/components/ui/list-controls";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listAuditLog, auditActions } from "@/lib/queries/audit";
import { parsePageParams } from "@/lib/pagination";

export const metadata = { title: "Audit log" };

/**
 * The full audit trail.
 *
 * It previously lived as a 25-row, four-column table at the bottom of the
 * support page, showing when / actor TYPE / action / entity TYPE — so it could
 * say that "a platform admin voided a receipt" but never which admin or which
 * receipt, which is the only thing anyone consults an audit log for.
 */
export default async function AuditPage({
  searchParams,
}: {
  searchParams?: { page?: string; q?: string; size?: string; action?: string; actor?: string };
}) {
  const session = await requirePlatformAdmin();
  const p = parsePageParams(searchParams);
  const filters = { action: searchParams?.action ?? "", actor: searchParams?.actor ?? "" };
  const [logs, actions] = await Promise.all([listAuditLog(p, filters), auditActions()]);
  const filtered = Boolean(p.q || filters.action || filters.actor);

  return (
    <>
      <Topbar title="Audit log" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <ListSearch
            action="/admin/audit"
            q={p.q}
            placeholder="Action, entity id or actor id…"
            label="Search the audit log"
          />
          <ListFilters
            action="/admin/audit"
            hidden={{ q: p.q }}
            filters={[
              {
                name: "action",
                label: "Action",
                value: filters.action,
                options: [
                  { value: "", label: "All actions" },
                  ...actions.map((a) => ({ value: a, label: a })),
                ],
              },
              {
                name: "actor",
                label: "Actor",
                value: filters.actor,
                options: [
                  { value: "", label: "Anyone" },
                  { value: "platform_admin", label: "Platform admin" },
                  { value: "org_user", label: "Org staff" },
                  { value: "donor", label: "Donor" },
                  { value: "system", label: "System" },
                ],
              },
            ]}
          />
        </div>

        <Card>
          <CardContent className="flex flex-col gap-4 p-4 sm:p-6">
            {logs.rows.length === 0 ? (
              <EmptyState
                icon={<ScrollText className="size-5" />}
                title={filtered ? "Nothing matches those filters" : "No audit events yet"}
                body={
                  filtered
                    ? "Try a different action, actor or search term."
                    : "Receipt issue and void, exports, erasures, impersonation and privileged admin changes are recorded here."
                }
              />
            ) : (
              <Table>
                <Thead>
                  <Th>When</Th>
                  <Th>Who</Th>
                  <Th>Action</Th>
                  <Th>On what</Th>
                  <Th>Change</Th>
                </Thead>
                <tbody>
                  {logs.rows.map((l) => (
                    <Tr key={l.id}>
                      <Td className="whitespace-nowrap text-muted-foreground">
                        {new Date(l.createdAt).toLocaleString("en-CA")}
                      </Td>
                      <Td>
                        <span className="block font-medium">{l.actorLabel}</span>
                        <span className="text-xs text-muted-foreground">
                          {l.actorType.replace("_", " ")}
                          {l.ip ? ` · ${l.ip}` : ""}
                        </span>
                      </Td>
                      <Td className="font-medium">{l.action}</Td>
                      <Td>
                        <span className="block text-muted-foreground">{l.entityType ?? "—"}</span>
                        {l.entityId && (
                          <span className="block font-mono text-xs text-muted-foreground">
                            {l.entityId}
                          </span>
                        )}
                        {l.orgName && (
                          <Badge variant="neutral" className="mt-1">
                            {l.orgName}
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        {l.changes.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <ul className="flex flex-col gap-0.5">
                            {l.changes.map((c) => (
                              <li key={c.field} className="text-xs">
                                <span className="font-medium">{c.field}</span>{" "}
                                <span className="text-muted-foreground line-through">
                                  {JSON.stringify(c.before) ?? "—"}
                                </span>{" "}
                                <span aria-hidden>→</span>{" "}
                                <span className="font-medium">{JSON.stringify(c.after)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
            <Pagination basePath="/admin/audit" data={logs} noun="events" extra={filters} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
