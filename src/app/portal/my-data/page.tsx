import { Download, FileJson, ShieldCheck } from "lucide-react";
import { Topbar } from "@/components/dashboard/topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { ErasureRequest } from "@/components/portal/erasure-request";
import { requireDonor } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";

export const metadata = { title: "Your data" };

/**
 * Donor data rights (PIPEDA; Quebec Law 25). None of this existed before — the
 * privacy policy promised access, correction, portability and erasure, and there
 * was no tooling for any of them, for donors or for organizations.
 */
export default async function MyDataPage() {
  const session = await requireDonor();

  const counts = await withTenant(session.orgId, async (tx) => {
    const [receipts, donations] = await Promise.all([
      tx.receipt.count({ where: { donorId: session.sub } }),
      tx.donation.count({ where: { donorId: session.sub } }),
    ]);
    return { receipts, donations };
  });

  return (
    <>
      <Topbar title="Your data" user={{ name: session.name, email: session.email }} />
      <main className="flex flex-col gap-6 p-4 sm:p-6">
        <Card>
          <CardHeader className="flex-row items-center gap-2">
            <ShieldCheck className="size-5 text-success" aria-hidden />
            <CardTitle>Your rights</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Under Canadian privacy law you can see what this organization holds about you, take a
            copy, correct it, and ask for it to be removed. You can change what we may email you at
            any time from your <strong className="text-foreground">Profile</strong>.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Download a copy</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Everything held about you: your profile, {counts.donations} donation
              {counts.donations === 1 ? "" : "s"}, {counts.receipts} receipt
              {counts.receipts === 1 ? "" : "s"}, your consent history, and a record of the messages
              we&apos;ve sent you. Saved card numbers are never included — we don&apos;t hold them.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/api/portal/my-data"
                className={buttonVariants({ size: "sm" })}
                download
              >
                <FileJson className="size-4" aria-hidden /> Download everything (JSON)
              </a>
              <a
                href="/api/portal/my-data?format=csv"
                className={buttonVariants({ variant: "outline", size: "sm" })}
                download
              >
                <Download className="size-4" aria-hidden /> Giving history (CSV)
              </a>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle>Remove your details</CardTitle>
          </CardHeader>
          <CardContent>
            <ErasureRequest receiptCount={counts.receipts} />
          </CardContent>
        </Card>
      </main>
    </>
  );
}
