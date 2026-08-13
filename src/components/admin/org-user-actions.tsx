"use client";

import { useState } from "react";
import { UserCheck, UserX } from "lucide-react";
import {
  adminInviteOrgUser,
  adminSetOrgUserRole,
  adminSetOrgUserStatus,
  type AdminState,
} from "@/app/admin/actions";
import { ActionButton } from "@/components/ui/action-button";
import { EditDialog } from "@/components/ui/edit-dialog";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "@/components/dashboard/invite-notice";

/**
 * Recovering a locked-out organization.
 *
 * God Mode could only reset a password. An org whose one admin had been disabled
 * or had left could not be recovered at all — there was no way to invite a new
 * admin, promote an existing user, or re-enable a disabled one.
 */
export function InviteOrgUserButton({ orgId }: { orgId: string }) {
  return (
    <EditDialog
      variant="outline"
      size="sm"
      title="Invite a user to this organization"
      description="They receive a single-use link to set their own password. No temporary password is created."
      action={adminInviteOrgUser}
      values={{ orgId }}
      submitLabel="Send invite"
      trigger={<>Invite user</>}
      fields={[
        { name: "name", label: "Name", required: true },
        { name: "email", kind: "email", label: "Email", required: true },
        {
          name: "role",
          kind: "select",
          label: "Role",
          value: "org_admin",
          options: [
            { value: "org_admin", label: "Admin — full access" },
            { value: "signatory", label: "Signatory — can sign receipts" },
            { value: "staff", label: "Staff — day-to-day access" },
          ],
        },
      ]}
    />
  );
}

export function OrgUserRoleSelect({
  userId,
  role,
}: {
  userId: string;
  role: string;
}) {
  const [state, setState] = useState<AdminState | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col items-end gap-1">
      <select
        aria-label="Role"
        defaultValue={role}
        disabled={pending}
        onChange={async (e) => {
          setPending(true);
          setState(await adminSetOrgUserRole(userId, e.target.value as "org_admin" | "signatory" | "staff"));
          setPending(false);
        }}
        className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      >
        <option value="org_admin">Admin</option>
        <option value="signatory">Signatory</option>
        <option value="staff">Staff</option>
      </select>
      {state?.error && (
        <p role="alert" className="max-w-xs text-right text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}

export function OrgUserStatusButton({
  userId,
  name,
  status,
}: {
  userId: string;
  name: string;
  status: string;
}) {
  const active = status === "active";
  return (
    <ActionButton
      variant="outline"
      size="sm"
      action={() => adminSetOrgUserStatus(userId, active ? "disabled" : "active")}
      confirm={
        active
          ? {
              title: `Disable ${name}?`,
              description:
                "They're signed out of every device immediately and can't sign in again until re-enabled. Nothing they've recorded is affected.",
              confirmLabel: "Disable user",
              destructive: true,
            }
          : undefined
      }
    >
      {active ? <UserX className="size-4" aria-hidden /> : <UserCheck className="size-4" aria-hidden />}
      {active ? "Disable" : "Enable"}
    </ActionButton>
  );
}

/** Shows the invite link when email delivery is unavailable. */
export function InviteResult({ state }: { state: AdminState | null }) {
  if (!state) return null;
  if (state.error) return <FormAlert className="max-w-sm">{state.error}</FormAlert>;
  if (state.ok && state.inviteUrl) {
    return (
      <div className="max-w-sm">
        <InviteNotice emailed={state.emailed} url={state.inviteUrl} />
      </div>
    );
  }
  return null;
}
