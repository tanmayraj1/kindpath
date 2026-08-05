import Link from "next/link";
import { Clock, AlertTriangle } from "lucide-react";
import type { BillingState } from "@/lib/access";

/**
 * Persistent, honest banner about subscription state.
 *
 * Deliberately never alarming during a trial and never threatening about donor
 * data: a charity's records, donors and issued receipts survive a lapsed
 * subscription. The banner says what changes and when, and links to the invoice.
 */
export function BillingBanner({
  billing,
  daysLeft,
}: {
  billing: BillingState;
  daysLeft: number | null;
}) {
  if (billing === "active" || billing === "none" || billing === "locked") return null;

  if (billing === "trialing") {
    // Only worth mentioning as the trial nears its end.
    if (daysLeft === null || daysLeft > 7) return null;
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 border-b border-border bg-secondary/60 px-4 py-2.5 text-sm sm:px-6"
      >
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>
          {daysLeft === 0
            ? "Your free trial ends today."
            : `${daysLeft} day${daysLeft === 1 ? "" : "s"} left in your free trial.`}{" "}
          Everything keeps working — we&apos;ll send an invoice when it ends.
        </span>
        <Link href="/dashboard/billing" className="font-medium text-brand-600 hover:underline">
          View billing
        </Link>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center gap-2 border-b border-warning/30 bg-warning/10 px-4 py-2.5 text-sm sm:px-6"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <span>
        You have an unpaid invoice.{" "}
        {daysLeft && daysLeft > 0
          ? `Your account stays fully available for ${daysLeft} more day${daysLeft === 1 ? "" : "s"}.`
          : "Access to new giving pages will pause shortly."}{" "}
        Your donor records and issued receipts are unaffected.
      </span>
      <Link href="/dashboard/billing" className="font-medium text-brand-600 hover:underline">
        View invoice
      </Link>
    </div>
  );
}
