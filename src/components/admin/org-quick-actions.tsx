"use client";

import { useState, useTransition } from "react";
import { UserCog, ShieldOff, ShieldCheck, Archive, Loader2 } from "lucide-react";
import {
  impersonateOrg,
  grantAccess,
  revokeAccess,
  setOrgStatus,
  type AdminState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";

export function OrgQuickActions({ orgId, status }: { orgId: string; status: string }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<AdminState | null>(null);
  const active = status === "active";
  const archived = status === "archived";

  const run = (fn: () => Promise<AdminState>) => start(async () => setResult(await fn()));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => run(() => impersonateOrg(orgId))}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <UserCog className="size-4" aria-hidden />
          )}
          Open as admin
        </Button>

        {active ? (
          <ConfirmButton
            variant="outline"
            size="sm"
            disabled={pending}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
            title="Revoke this organization's access?"
            description="Everyone at this organization — admins, staff, volunteers and donors — is signed out immediately and locked out, and the subscription is cancelled. Their data is retained."
            confirmLabel="Revoke access"
            destructive
            onConfirm={() => run(() => revokeAccess(orgId))}
          >
            <ShieldOff className="size-4" aria-hidden /> Revoke access
          </ConfirmButton>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            className="border-success/30 text-success hover:bg-success/10"
            onClick={() => run(() => grantAccess(orgId))}
          >
            <ShieldCheck className="size-4" aria-hidden /> Grant access
          </Button>
        )}

        {/* Archiving was modelled (OrgStatus.archived) but had no control anywhere,
            so an org could only ever be suspended, never retired. */}
        {archived ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(() => setOrgStatus(orgId, "active"))}
          >
            <ShieldCheck className="size-4" aria-hidden /> Unarchive
          </Button>
        ) : (
          <ConfirmButton
            variant="ghost"
            size="sm"
            disabled={pending}
            title="Archive this organization?"
            description="Archiving retires an organization that has finished with KindPath. Everyone is signed out and it leaves the active roster. Nothing is deleted — donations, donors and every issued receipt are retained, and archiving can be undone."
            confirmLabel="Archive"
            destructive
            onConfirm={() => run(() => setOrgStatus(orgId, "archived"))}
          >
            <Archive className="size-4" aria-hidden /> Archive
          </ConfirmButton>
        )}
      </div>

      {result?.error && <FormAlert className="max-w-md">{result.error}</FormAlert>}
    </div>
  );
}
