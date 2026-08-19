import Link from "next/link";
import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = {
  title: "Set up portal access",
  robots: { index: false },
};

/**
 * How a donor gets into their giving portal.
 *
 * Donor accounts are created by donating — the record exists the moment a gift is
 * recorded — but nothing ever set a password on one, so the entire portal was
 * unreachable. This is the door.
 *
 * Deliberately NOT under /portal: middleware guards `/portal/:path*`, so a
 * /portal/claim page would bounce a logged-out donor straight to /login, which is
 * exactly the dead end being fixed.
 *
 * It posts to the same `requestPasswordReset` action as /forgot. That action
 * treats "no password yet" as a first-time setup and "has a password" as a reset,
 * so one code path serves both and neither response reveals which case applies.
 */
export default function ClaimPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Set up portal access</h1>
        <p className="text-sm text-muted-foreground">
          Enter the email address you gave with. We&apos;ll send you a link to choose a password,
          then you can see your receipts, manage recurring gifts and update your card.
        </p>
      </div>

      <ForgotForm mode="claim" />

      <p className="text-center text-sm text-muted-foreground">
        Already set a password?{" "}
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
