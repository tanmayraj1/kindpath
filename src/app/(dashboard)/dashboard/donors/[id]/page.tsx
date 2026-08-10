import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, Mail, Phone, MapPin } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, Thead, Th, Tr, Td } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { DonorEditForm } from "@/components/dashboard/donor-edit-form";
import { DonorPrivacyActions } from "@/components/dashboard/donor-privacy-actions";
import { requireOrgUser } from "@/lib/auth/guards";
import { getOrgDonorDetail } from "@/lib/queries/org";
import { formatCAD } from "@/lib/utils";

const statusVariant: Record<string, "success" | "destructive" | "warning" | "neutral"> = {
  succeeded: "success",
  failed: "destructive",
  pending: "warning",
  refunded: "neutral",
};

export default async function DonorDetailPage({ params }: { params: { id: string } }) {
  const session = await requireOrgUser();
  const data = await getOrgDonorDetail(session.orgId, params.id);
  if (!data) notFound();

  return (
    <>
      <Topbar title="Donor profile" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-6">
        <Link
          href="/dashboard/donors"
          className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to donors
        </Link>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardContent className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <span className="grid size-12 place-items-center rounded-full bg-brand-100 text-base font-semibold text-brand-700">
                  {data.donor.name.split(" ").map((n) => n[0]).join("")}
                </span>
                <div>
                  <p className="font-display text-lg font-semibold">{data.donor.name}</p>
                  <Badge variant={data.donor.casl === "none" ? "outline" : "neutral"} className="mt-1 capitalize">
                    CASL: {data.donor.casl}
                  </Badge>
                </div>
              </div>
              <div className="flex flex-col gap-2.5 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" /> {data.donor.email}
                </p>
                {data.donor.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="size-4" /> {data.donor.phone}
                  </p>
                )}
                <p className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-4" />
                  {data.donor.address || "No address on file"}
                  {!data.donor.addressComplete && (
                    <Badge variant="warning" className="ml-1">
                      Incomplete
                    </Badge>
                  )}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 text-center">
                <div>
                  <p className="font-display text-lg font-bold">{formatCAD(data.totalGiven, { maximumFractionDigits: 0 })}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
                <div>
                  <p className="font-display text-lg font-bold">{data.activePlans}</p>
                  <p className="text-xs text-muted-foreground">Plans</p>
                </div>
                <div>
                  <p className="font-display text-lg font-bold">{data.receiptsCount}</p>
                  <p className="text-xs text-muted-foreground">Receipts</p>
                </div>
              </div>
              <div className="mt-2 border-t border-border pt-4">
                <DonorEditForm
                  donor={{
                    id: data.donor.id,
                    firstName: data.donor.firstName,
                    lastName: data.donor.lastName,
                    phone: data.donor.phone,
                    addressLine1: data.donor.addressLine1,
                    city: data.donor.city,
                    province: data.donor.province,
                    postalCode: data.donor.postalCode,
                    notes: data.donor.notes,
                    emailMarketingOptIn: data.donor.emailMarketingOptIn,
                    smsMarketingOptIn: data.donor.smsMarketingOptIn,
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Privacy requests</CardTitle>
            </CardHeader>
            <CardContent>
              <DonorPrivacyActions
                donorId={data.donor.id}
                donorName={data.donor.name}
                anonymized={!!data.donor.anonymizedAt}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Donation history</CardTitle>
            </CardHeader>
            <CardContent>
              {data.donations.length === 0 ? (
                <EmptyState title="No donations yet" />
              ) : (
                <Table>
                  <Thead>
                    <Th>Date</Th>
                    <Th>Fund</Th>
                    <Th className="text-right">Amount</Th>
                    <Th className="text-right">Status</Th>
                    <Th className="text-right">Receipt</Th>
                  </Thead>
                  <tbody>
                    {data.donations.map((d) => (
                      <Tr key={d.id}>
                        <Td className="text-muted-foreground">
                          {new Date(d.date).toLocaleDateString("en-CA")}
                        </Td>
                        <Td className="font-medium">{d.fund}</Td>
                        <Td className="text-right font-medium">
                          {formatCAD(d.amount, { maximumFractionDigits: 0 })}
                        </Td>
                        <Td className="text-right">
                          <Badge variant={statusVariant[d.status] ?? "neutral"} className="capitalize">
                            {d.status}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          {d.receiptId ? (
                            <a
                              href={`/api/receipts/${d.receiptId}/pdf`}
                              target="_blank"
                              rel="noopener"
                              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"
                            >
                              <Download className="size-4" /> PDF
                            </a>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </>
  );
}
