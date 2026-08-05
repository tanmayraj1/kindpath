"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { KeyRound, Ban, RotateCcw, TicketPlus } from "lucide-react";
import {
  setVolunteerStatus,
  resetVolunteerPassword,
  issuePass,
  revokePass,
  type VolunteerState,
} from "@/app/(dashboard)/dashboard/volunteers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "./invite-notice";
import { SubmitButton } from "@/components/auth/submit-button";

export function VolunteerRowActions({
  volunteerId,
  status,
}: {
  volunteerId: string;
  status: "active" | "inactive";
}) {
  const [pending, start] = useTransition();
  const [reset, setReset] = useState<VolunteerState | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center justify-end gap-1">
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          title="Reset password"
          onClick={() =>
            start(async () => {
              setReset(await resetVolunteerPassword(volunteerId));
            })
          }
        >
          <KeyRound className="size-4" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          title={status === "active" ? "Deactivate" : "Reactivate"}
          onClick={() =>
            start(async () => {
              await setVolunteerStatus(volunteerId, status === "active" ? "inactive" : "active");
            })
          }
        >
          {status === "active" ? <Ban className="size-4" /> : <RotateCcw className="size-4" />}
        </Button>
      </div>
      {reset?.error && <FormAlert className="w-72">{reset.error}</FormAlert>}
      {reset?.ok && (
        <div className="w-72">
          <InviteNotice emailed={reset.emailed} url={reset.inviteUrl} what="Password reset link" />
        </div>
      )}
    </div>
  );
}

const initial: VolunteerState = {};

export function IssuePassForm({ volunteerId }: { volunteerId: string }) {
  const [state, action] = useFormState(issuePass, initial);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="volunteerId" value={volunteerId} />
      <div className="flex min-w-40 flex-1 flex-col gap-1">
        <label htmlFor={`pass-title-${volunteerId}`} className="text-xs text-muted-foreground">
          Pass title
        </label>
        <Input
          id={`pass-title-${volunteerId}`}
          name="title"
          placeholder="Langar Hall Access 2026"
          className="h-9"
          required
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={`pass-until-${volunteerId}`} className="text-xs text-muted-foreground">
          Valid until (optional)
        </label>
        <Input id={`pass-until-${volunteerId}`} name="validUntil" type="date" className="h-9" />
      </div>
      <SubmitButton size="sm">
        <TicketPlus className="size-4" /> Issue pass
      </SubmitButton>
      {state.error && <FormAlert className="w-full">{state.error}</FormAlert>}
    </form>
  );
}

export function RevokePassButton({ passId }: { passId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-destructive hover:text-destructive"
      disabled={pending}
      onClick={() => start(async () => revokePass(passId))}
    >
      Revoke
    </Button>
  );
}
