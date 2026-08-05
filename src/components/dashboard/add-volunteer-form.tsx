"use client";

import { useFormState } from "react-dom";
import { addVolunteer, type VolunteerState } from "@/app/(dashboard)/dashboard/volunteers/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { InviteNotice } from "./invite-notice";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: VolunteerState = {};

export function AddVolunteerForm() {
  const [state, action] = useFormState(addVolunteer, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      {state.ok && (
        <InviteNotice emailed={state.emailed} url={state.inviteUrl} what="Volunteer invitation" />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-firstName">First name</Label>
          <Input id="v-firstName" name="firstName" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-lastName">Last name</Label>
          <Input id="v-lastName" name="lastName" required />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-email">Email</Label>
          <Input id="v-email" name="email" type="email" aria-invalid={!!state.error} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-phone">Phone (optional)</Label>
          <Input id="v-phone" name="phone" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="v-role">Role (optional)</Label>
          <Input id="v-role" name="role" placeholder="Kitchen seva, Usher, …" />
        </div>
      </div>
      <div>
        <SubmitButton>Add volunteer</SubmitButton>
      </div>
    </form>
  );
}
