import Link from "next/link";
import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/reset-form";
import { FormAlert } from "@/components/ui/form-alert";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false } };

export default function ResetPasswordPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          {/* Deliberately not "expires in an hour": this page serves reset links
              (1 hour) AND first-time setup links (7 days) at the same URL, so a
              fixed number told invited users their still-valid link was dead. */}
          This link can be used once. If it&apos;s expired, request a new one.
        </p>
      </div>

      {token ? (
        <ResetForm token={token} />
      ) : (
        <div className="flex flex-col gap-4">
          <FormAlert>
            This reset link is incomplete. Request a fresh one and use the most recent email.
          </FormAlert>
          <Link
            href="/forgot"
            className="text-center text-sm font-medium text-brand-600 hover:underline"
          >
            Request a new link
          </Link>
        </div>
      )}
    </div>
  );
}
