import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { readTwoFactorTicket } from "@/lib/auth/twofa-ticket";
import { TwoFactorForm } from "@/components/auth/two-factor-form";

export const metadata: Metadata = { title: "Two-factor authentication", robots: { index: false } };

export default async function TwoFactorPage() {
  // No valid pending ticket → nothing to verify; back to login.
  if (!(await readTwoFactorTicket())) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">Two-factor authentication</h1>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app. You can also use one of your recovery
          codes.
        </p>
      </div>

      <TwoFactorForm />

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
