import { Download, Info } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Td, Tr } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { FormAlert } from "@/components/ui/form-alert";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrgBilling } from "@/lib/queries/billing";
import { getPaymentInstructions } from "@/lib/subscription-payments";
import { formatCAD } from "@/lib/utils";

export const metadata = { title: "Billing" };

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  paid: { label: "Paid", variant: "success" },
  issued: { label: "Awaiting payment", variant: "warning" },
  draft: { label: "Draft", variant: "neutral" },
  void: { label: "Void", variant: "neutral" },
};

function date(d: Date) {
  return new Date(d).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export default async function BillingPage() {
  const session = await requireOrgUser();
  const billing = await getOrgBilling(session.orgId);
  const payment = getPaymentInstructions(billing?.outstandingTotal ?? 0);

  return (
    <>
      <Topbar title="Billing" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-4 sm:p-6">
        {!billing ? (
          <Card>
            <CardContent className="p-6">
              <EmptyState
                title="No subscription on file"
                body="Contact KindPath to set up your plan."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-bold capitalize">{billing.plan}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {formatCAD(billing.priceCad)} / {billing.cycle === "annual" ? "year" : "month"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-bold capitalize">
                    {billing.status.replace("_", " ")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {billing.status === "trialing" && billing.trialEndsAt
                      ? `Trial ends ${date(billing.trialEndsAt)}`
                      : billing.nextBillingDate
                        ? `Next invoice ${date(billing.nextBillingDate)}`
                        : "—"}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Outstanding
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-2xl font-bold">
                    {formatCAD(billing.outstandingTotal)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {billing.outstandingTotal > 0 ? "Payment due" : "Nothing owing"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* "Payment due" used to be a number with no next step. Billing is
                still arranged manually, so say how to pay rather than render a
                button that doesn't do anything. */}
            {billing.outstandingTotal > 0 && (
              <Card className="border-warning/40">
                <CardHeader>
                  <CardTitle>{payment.heading}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
                  <p>{payment.body}</p>
                  <p>
                    Questions about an invoice?{" "}
                    <a
                      href={`mailto:${payment.contactEmail}`}
                      className="font-medium text-brand-600 hover:underline"
                    >
                      {payment.contactEmail}
                    </a>
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Next invoice</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <dl className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Subtotal</dt>
                    <dd>{formatCAD(billing.preview.subtotal)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">
                      {billing.preview.taxLabel}
                      {billing.province ? ` · ${billing.province}` : ""}
                    </dt>
                    <dd>{formatCAD(billing.preview.taxAmount)}</dd>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2 font-semibold">
                    <dt>Total</dt>
                    <dd>{formatCAD(billing.preview.total)}</dd>
                  </div>
                </dl>

                {!billing.province && (
                  <FormAlert variant="info">
                    Add your organization&apos;s province in Settings so we apply the right sales
                    tax. Until then we bill 5% GST.
                  </FormAlert>
                )}
                {billing.preview.provincialTaxNotCollected && (
                  <FormAlert variant="info">
                    <span className="flex items-start gap-1.5">
                      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      Your province charges a separate provincial sales tax that KindPath does not
                      currently collect. You may need to self-assess it.
                    </span>
                  </FormAlert>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Invoice history</CardTitle>
              </CardHeader>
              <CardContent>
                {billing.invoices.length === 0 ? (
                  <EmptyState
                    title="No invoices yet"
                    body="Your first invoice is issued when your trial ends."
                  />
                ) : (
                  <Table>
                    <Thead>
                      <Th>Invoice</Th>
                      <Th>Issued</Th>
                      <Th>Subtotal</Th>
                      <Th>Tax</Th>
                      <Th>Total</Th>
                      <Th>Status</Th>
                      <Th className="text-right">PDF</Th>
                    </Thead>
                    <tbody>
                      {billing.invoices.map((i) => {
                        const s = STATUS_LABEL[i.status] ?? {
                          label: i.status,
                          variant: "neutral" as const,
                        };
                        return (
                          <Tr key={i.id}>
                            <Td className="font-mono text-xs">{i.invoiceNumber}</Td>
                            <Td className="text-muted-foreground">{date(i.issuedAt)}</Td>
                            <Td>{formatCAD(i.subtotal)}</Td>
                            <Td>{formatCAD(i.taxAmount)}</Td>
                            <Td className="font-medium">{formatCAD(i.total)}</Td>
                            <Td>
                              <Badge variant={s.variant}>{s.label}</Badge>
                            </Td>
                            <Td className="text-right">
                              <a
                                href={`/api/invoices/${i.id}/pdf`}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
                              >
                                <Download className="size-4" aria-hidden /> PDF
                              </a>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </>
  );
}
