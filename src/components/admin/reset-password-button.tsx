"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { resetOrgUserPassword, type AdminState } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "@/components/dashboard/invite-notice";

export function ResetPasswordButton({ userId, email }: { userId: string; email?: string }) {
  const [result, setResult] = useState<AdminState | null>(null);
  const [, start] = useTransition();

  return (
    <div className="flex flex-col items-end gap-2">
      <ConfirmButton
        variant="outline"
        size="sm"
        title="Reset this admin's password?"
        description={
          <>
            Their current password stops working immediately and every device signed in as them is
            signed out. They&apos;ll receive a single-use link to choose a new password — no
            temporary password is created.
          </>
        }
        confirmLabel="Reset password"
        destructive
        onConfirm={() => start(async () => setResult(await resetOrgUserPassword(userId)))}
      >
        <KeyRound className="size-4" aria-hidden />
        Reset password
      </ConfirmButton>

      {result?.error && <FormAlert className="max-w-sm">{result.error}</FormAlert>}
      {result?.ok && (
        <div className="max-w-sm">
          <InviteNotice
            emailed={result.emailed}
            url={result.inviteUrl}
            email={email}
            what="Password reset link"
          />
        </div>
      )}
    </div>
  );
}
