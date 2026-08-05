import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guards";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export const metadata: Metadata = { title: "Update your password", robots: { index: false } };

/**
 * Where invited users and admin-reset accounts land. `loginAction` routes here
 * whenever `mustChangePassword` is set, so a temporary password can't be left in
 * place indefinitely.
 */
export default async function ChangePasswordPage() {
  const session = await requireSession();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold tracking-tight">Update your password</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as {session.email}. Choose a password only you know before you continue.
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
