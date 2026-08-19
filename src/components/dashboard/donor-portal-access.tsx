"use client";

import { useState, useTransition } from "react";
import { KeyRound } from "lucide-react";
import { sendDonorPortalInvite, type TeamState } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "@/components/dashboard/invite-notice";

/**
 * Whether a donor can reach their giving portal, and a way to help them if not.
 *
 * Donors get there on their own from the link in every receipt email. This is for
 * the call that follows when that link never arrived.
 */
export function DonorPortalAccess({
  donorId,
  hasAccess,
  anonymized,
}: {
  donorId: string;
  hasAccess: boolean;
  anonymized: boolean;
}) {
  const [result, setResult] = useState<TeamState | null>(null);
  const [pending, start] = useTransition();

  if (anonymized) {
    return (
      <p className="text-sm text-muted-foreground">
        This donor asked to be removed, so portal access no longer applies.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {hasAccess
          ? "This donor has set up portal access. Sending a link lets them choose a new password."
          : "This donor hasn't set up portal access yet. Every receipt email invites them to; send a link directly if it never arrived."}
      </p>

      <div>
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => start(async () => setResult(await sendDonorPortalInvite(donorId)))}
        >
          <KeyRound className="size-4" aria-hidden />
          {hasAccess ? "Send a password reset link" : "Send portal setup link"}
        </Button>
      </div>

      {result?.error && <FormAlert>{result.error}</FormAlert>}
      {result?.ok && (
        <InviteNotice emailed={result.emailed} url={result.inviteUrl} />
      )}
    </div>
  );
}
