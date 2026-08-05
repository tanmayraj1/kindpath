"use client";

import { useFormState } from "react-dom";
import { createOrganization, type AdminState } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "@/components/dashboard/invite-notice";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: AdminState = {};

export function CreateOrgForm() {
  const [state, action] = useFormState(createOrganization, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      {state.ok && (
        <InviteNotice
          emailed={state.emailed}
          url={state.inviteUrl}
          what="Organization created — admin invitation"
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Organization name</Label>
          <Input id="name" name="name" placeholder="Grace Community Church" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="charityStatus">Charity status</Label>
          <select
            id="charityStatus"
            name="charityStatus"
            defaultValue="registered"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="registered">Registered charity</option>
            <option value="non_registered">Not a registered charity</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="adminName">Admin name</Label>
          <Input id="adminName" name="adminName" placeholder="Jane Doe" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="adminEmail">Admin email</Label>
          <Input id="adminEmail" name="adminEmail" type="email" placeholder="admin@org.org" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="plan">Plan</Label>
          <select
            id="plan"
            name="plan"
            defaultValue="community"
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            <option value="starter">Starter — $29/mo</option>
            <option value="community">Community — $59/mo</option>
            <option value="enterprise">Enterprise — $199/mo</option>
          </select>
        </div>
      </div>

      <div>
        <SubmitButton>Create organization</SubmitButton>
      </div>
    </form>
  );
}
