"use client";

import { useFormState } from "react-dom";
import { UserPlus } from "lucide-react";
import { inviteTeamMember, type TeamState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "./invite-notice";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: TeamState = {};
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function InviteTeamForm() {
  const [state, action] = useFormState(inviteTeamMember, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      {state.ok && <InviteNotice emailed={state.emailed} url={state.inviteUrl} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="Alex Smith" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="alex@org.org"
            aria-invalid={!!state.error}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role">Role</Label>
          <select id="role" name="role" defaultValue="staff" className={selectCls}>
            <option value="org_admin">Admin (full access)</option>
            <option value="signatory">Signatory (signs receipts)</option>
            <option value="staff">Staff (limited)</option>
          </select>
        </div>
      </div>
      <div>
        <SubmitButton>
          <UserPlus className="size-4" /> Invite teammate
        </SubmitButton>
      </div>
    </form>
  );
}
