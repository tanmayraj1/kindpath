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
          This link can be used once and expires an hour after it was sent.
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
