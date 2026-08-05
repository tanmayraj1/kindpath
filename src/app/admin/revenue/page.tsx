import { Download } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listPlatformBilling, mrrOf } from "@/lib/queries/billing";
import { InvoiceActions, RunSubscriptionCycleButton } from "@/components/admin/invoice-actions";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Revenue" };

const SUB_VARIANT: Record<string, "success" | "warning" | "destructive" | "neutral"> = {
  active: "success",
  trialing: "warning",
  past_due: "destructive",
  cancelled: "neutral",
};

function date(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" }) : "—";
}

/**
 * KindPath's own revenue position. Distinct from /admin/subscriptions, which
 * shows plan configuration; this page answers "who owes us money".
 */
export default async function RevenuePage() {
  const session = await requirePlatformAdmin();
  const rows = await listPlatformBilling();

  const mrr = mrrOf(rows);
  const outstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const paying = rows.filter((r) => r.subscriptionStatus === "active").length;
  const trialing = rows.filter((r) => r.subscriptionStatus === "trialing").length;

  return (
    <>
      <Topbar
        title="Revenue"
        user={{ name: session.name, email: session.email }}
        action={<RunSubscriptionCycleButton />}
      />
      <main className="flex flex-col gap-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "MRR", value: formatCAD(mrr), hint: `${paying} paying` },
            { label: "Outstanding", value: formatCAD(outstanding), hint: "unpaid invoices" },
            { label: "In trial", value: String(trialing), hint: "not yet billed" },
            { label: "Organizations", value: String(rows.length), hint: "total" },
          ].map((s) => (
            <Card key={s.label}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-display text-2xl font-bold">{s.value}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.hint}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <EmptyState title="No organizations yet" body="Create one to start billing." />
            ) : (
              <Table>
                <Thead>
                  <Th>Organization</Th>
                  <Th>Plan</Th>
                  <Th>Province</Th>
                  <Th>Trial ends</Th>
                  <Th>Latest invoice</Th>
                  <Th className="text-right">Outstanding</Th>
                  <Th className="text-right">Status</Th>
                  <Th className="text-right">Actions</Th>
                </Thead>
                <tbody>
                  {rows.map((r) => (
                    <Tr key={r.orgId}>
                      <Td className="font-medium">{r.name}</Td>
                      <Td className="capitalize text-muted-foreground">
                        {r.plan ?? "—"}
                        {r.plan ? ` · ${formatCAD(r.priceCad)}/${r.cycle === "annual" ? "yr" : "mo"}` : ""}
                      </Td>
                      <Td className="text-muted-foreground">{r.province ?? "—"}</Td>
                      <Td className="text-muted-foreground">{date(r.trialEndsAt)}</Td>
                      <Td>
                        {r.lastInvoice ? (
                          <a
                            href={`/api/invoices/${r.lastInvoice.id}/pdf`}
                            target="_blank"
                            rel="noopener"
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-brand-600 hover:underline"
                          >
                            <Download className="size-3.5" aria-hidden />
                            {r.lastInvoice.invoiceNumber}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </Td>
                      <Td className="text-right font-medium">
                        {r.outstanding > 0 ? formatCAD(r.outstanding) : "—"}
                      </Td>
                      <Td className="text-right">
                        <Badge variant={SUB_VARIANT[r.subscriptionStatus ?? ""] ?? "neutral"}>
                          {(r.subscriptionStatus ?? "none").replace("_", " ")}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <InvoiceActions
                          orgId={r.orgId}
                          orgName={r.name}
                          latestInvoiceId={r.lastInvoice?.id ?? null}
                          latestInvoicePaid={r.lastInvoice?.status === "paid"}
                        />
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
