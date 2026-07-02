import { notFound } from "next/navigation";
import { CheckCircle2, Download, Home } from "lucide-react";
import { adminDb } from "@/lib/db";
import { signedReceiptPath, verifyReceiptToken } from "@/lib/receipt-links";
import { getSession } from "@/lib/auth/session";
import { Logo } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCAD } from "@/lib/utils";

export const metadata = { title: "Your receipt", robots: { index: false } };

export default async function ReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { t?: string };
}) {
  const receipt = await adminDb.receipt.findUnique({ where: { id: params.id } });
  if (!receipt) notFound();

  // PII gate: a valid signed token (emailed/post-donation link) OR an entitled session.
  let allowed = verifyReceiptToken(receipt.id, searchParams.t);
  if (!allowed) {
    const session = await getSession();
    if (session) {
      allowed =
        session.kind === "platform" ||
        (session.kind === "org" && session.orgId === receipt.orgId) ||
        (session.kind === "donor" && session.sub === receipt.donorId);
    }
  }
  if (!allowed) notFound();

  const official = receipt.documentType !== "confirmation";

  const rows = [
    ["Receipt number", receipt.serialNumber],
    ["Issued to", receipt.donorNameSnapshot],
    ["Address", receipt.donorAddressSnapshot],
    ["Organization", receipt.orgNameSnapshot],
    ...(official && receipt.orgRegNumberSnapshot
      ? [["Charity reg. no.", receipt.orgRegNumberSnapshot]]
      : []),
    ["Date received", new Date(receipt.dateDonationReceived).toLocaleDateString("en-CA")],
  ] as [string, string][];

  return (
    <div className="grid min-h-screen place-items-center bg-secondary/40 p-6">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="rounded-2xl border border-border bg-card p-8 shadow-lg">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-success/10 text-success">
              <CheckCircle2 className="size-7" />
            </span>
            <h1 className="font-display text-2xl font-bold">Thank you for your gift!</h1>
            <Badge variant={official ? "success" : "neutral"}>
              {official ? "Official donation receipt" : "Payment confirmation"}
            </Badge>
          </div>

          <div className="my-6 rounded-xl bg-secondary/60 p-5 text-center">
            <p className="text-sm text-muted-foreground">
              {official ? "Eligible amount for tax purposes" : "Amount paid"}
            </p>
            <p className="font-display text-3xl font-bold text-brand-600">
              {formatCAD(Number(receipt.eligibleAmount))}
            </p>
          </div>

          <dl className="flex flex-col divide-y divide-border text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-6 py-2.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="text-right font-medium">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a
              href={signedReceiptPath(receipt.id)}
              target="_blank"
              rel="noopener"
              className={cn(buttonVariants({ size: "lg" }), "flex-1")}
            >
              <Download className="size-4" /> Download PDF
            </a>
            <a
              href="/"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
            >
              <Home className="size-4" /> Done
            </a>
          </div>

          {official && (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              A copy has been recorded for your records. For tax information visit
              canada.ca/charities-giving.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
