"use client";

import { useState, useTransition } from "react";
import { KeyRound, Ban, RotateCcw, Loader2 } from "lucide-react";
import {
  setTeamMemberRole,
  setTeamMemberStatus,
  resetTeamMemberPassword,
  type TeamState,
} from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "./invite-notice";

export function TeamActions({
  userId,
  email,
  role,
  status,
  isSelf,
}: {
  userId: string;
  email?: string;
  role: string;
  status: string;
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<TeamState | null>(null);

  if (isSelf) {
    return <span className="text-xs text-muted-foreground">You</span>;
  }

  const run = (fn: () => Promise<TeamState>) => start(async () => setResult(await fn()));

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <label htmlFor={`role-${userId}`} className="sr-only">
          Role
        </label>
        <select
          id={`role-${userId}`}
          defaultValue={role}
          disabled={pending}
          onChange={(e) =>
            run(() =>
              setTeamMemberRole(userId, e.target.value as "org_admin" | "signatory" | "staff")
            )
          }
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <option value="org_admin">Admin</option>
          <option value="signatory">Signatory</option>
          <option value="staff">Staff</option>
        </select>

        <ConfirmButton
          variant="outline"
          size="sm"
          title="Reset this person's password?"
          description="They'll be signed out everywhere and emailed a single-use link to choose a new password."
          confirmLabel="Send reset link"
          destructive
          onConfirm={() => run(() => resetTeamMemberPassword(userId))}
        >
          <KeyRound className="size-4" aria-hidden />
          <span className="sr-only">Reset password</span>
        </ConfirmButton>

        {status === "active" ? (
          <ConfirmButton
            variant="ghost"
            size="sm"
            className="text-destructive hover:bg-destructive/10"
            title="Disable this team member?"
            description="They lose access immediately — including to donor records — and any active session is ended."
            confirmLabel="Disable"
            destructive
            onConfirm={() => run(() => setTeamMemberStatus(userId, "disabled"))}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Ban className="size-4" aria-hidden />
            )}
            Disable
          </ConfirmButton>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="text-success hover:bg-success/10"
            onClick={() => run(() => setTeamMemberStatus(userId, "active"))}
          >
            <RotateCcw className="size-4" aria-hidden /> Enable
          </Button>
        )}
      </div>

      {result?.error && <FormAlert className="max-w-sm text-left">{result.error}</FormAlert>}
      {result?.inviteUrl && (
        <div className="max-w-sm text-left">
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
