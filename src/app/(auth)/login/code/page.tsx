import Link from "next/link";
import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { LoginCodeForm } from "@/components/auth/login-code-form";

export const metadata: Metadata = { title: "Sign in with a code", robots: { index: false } };

/**
 * Passwordless sign-in for donors and volunteers.
 *
 * This exists because the realistic donor arrives from a receipt email on a
 * phone and is asked for a password they have never set. `/claim` solves that
 * with a second email hop; a code removes the hop.
 *
 * Staff addresses reach this page too and simply never receive a code — org and
 * platform admins keep password + TOTP, and the server says the same thing
 * either way so the page can't be used to sort staff addresses from donor ones.
 */
export default function LoginCodePage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="grid size-11 place-items-center rounded-full bg-brand-50 text-brand-600">
          <KeyRound className="size-5 stroke-[1.5]" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">Sign in with a code</h1>
        <p className="text-sm text-muted-foreground">
          No password needed. We&apos;ll email you a 6-digit code.
        </p>
      </div>

      <LoginCodeForm next={searchParams.next} />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Use a password instead
        </Link>
      </p>
    </div>
  );
}
