import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonVariants } from "@/components/ui/button";
import { consumeEmailVerification } from "@/lib/auth/email-verification";

export const metadata = { title: "Confirm your email", robots: { index: false } };
export const dynamic = "force-dynamic";

const REASONS: Record<string, string> = {
  invalid: "That link isn't valid. It may have been mistyped, or already replaced by a newer one.",
  expired: "That link has expired. Sign in and we'll send you a fresh one.",
  used: "That link has already been used — your email is confirmed.",
};

/**
 * Consume an email-verification link.
 *
 * Nothing in the app is gated on verification yet, so this page is
 * informational: it records that the address was proven and says so. Failure
 * messages never reveal whether an account exists.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const result = await consumeEmailVerification(searchParams.token ?? "");
  const ok = result.ok;

  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <Logo className="mx-auto" />
        <span
          className={`mx-auto mt-6 grid size-12 place-items-center rounded-full ${
            ok ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {ok ? <CheckCircle2 className="size-6" /> : <XCircle className="size-6" />}
        </span>
        <h1 className="mt-4 font-display text-xl font-bold">
          {ok ? "Email confirmed" : "We couldn't confirm that link"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ok
            ? result.alreadyVerified
              ? "This address was already confirmed — nothing more to do."
              : "Thanks. Receipts, billing notices and password resets will reach you here."
            : REASONS[result.reason]}
        </p>
        <Link href="/dashboard" className={buttonVariants({ size: "lg" }) + " mt-6"}>
          Go to your dashboard
        </Link>
      </div>
    </div>
  );
}
