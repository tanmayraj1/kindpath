import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { adminDb } from "@/lib/db";
import { checkDetailsToken } from "@/lib/receipt-details-link";
import { signReceiptToken } from "@/lib/receipt-links";
import { formatCAD } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { ReceiptDetailsForm } from "@/components/give/receipt-details-form";

export const metadata = { title: "Finish your receipt", robots: { index: false } };
export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="surface-donor grid min-h-screen place-items-center bg-background p-4">
      <div className="w-full max-w-lg rounded-card border border-border bg-card p-6 shadow-soft sm:p-8">
        {children}
      </div>
    </main>
  );
}

function Notice({
  tone,
  title,
  body,
}: {
  tone: "error" | "info";
  title: string;
  body: string;
}) {
  const Icon = tone === "error" ? AlertCircle : Clock;
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span
        className={`grid size-12 place-items-center rounded-full ${
          tone === "error" ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning-foreground"
        }`}
      >
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-xl font-bold">{title}</h1>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

/**
 * The page the "finish your receipt" email links to.
 *
 * The signed token is the only credential — it went to the address the donor gave
 * at the terminal — so this page is deliberately reachable without a login and
 * shows nothing about the donor until that token verifies.
 */
export default async function ReceiptDetailsPage({
  params,
  searchParams,
}: {
  params: { donationId: string };
  searchParams: { t?: string };
}) {
  const tokenState = checkDetailsToken(params.donationId, searchParams.t);

  // An unsigned or wrong token is told nothing at all — not even that the
  // donation exists. Guessing a UUID must not confirm a gift was made.
  if (tokenState === "invalid") notFound();

  const donation = await adminDb.donation.findUnique({
    where: { id: params.donationId },
    include: { org: true, donor: true, receipt: true },
  });
  if (!donation) notFound();

  if (tokenState === "expired") {
    return (
      <Shell>
        <Notice
          tone="info"
          title="This link has expired"
          body={`Your gift to ${donation.org.name} is still recorded — nothing has been lost. Contact them and they can issue your receipt for you.`}
        />
      </Shell>
    );
  }

  // Already finished: hand over the receipt rather than an empty form.
  if (donation.receipt) {
    redirect(`/r/${donation.receipt.id}?t=${signReceiptToken(donation.receipt.id)}`);
  }

  const amount = Number(donation.eligibleAmount ?? donation.amount);

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="grid size-11 place-items-center rounded-full bg-success/10">
            <CheckCircle2 className="size-5 text-success" aria-hidden />
          </span>
          <h1 className="font-display text-xl font-bold">One step left</h1>
          <p className="text-sm text-muted-foreground">
            Your gift of <span className="font-semibold">{formatCAD(amount)}</span> to{" "}
            {donation.org.name} is recorded. Add your name and address and we&apos;ll issue your
            official tax receipt right away.
          </p>
        </div>

        <ReceiptDetailsForm
          donationId={donation.id}
          token={searchParams.t ?? ""}
          orgName={donation.org.name}
          amountLabel={formatCAD(amount)}
          email={donation.donor.email}
        />

        <p className="text-center text-xs text-muted-foreground">
          Questions about your gift?{" "}
          <Link href="/contact" className="font-medium text-brand-600 hover:underline">
            Contact us
          </Link>
        </p>
      </div>
    </Shell>
  );
}
