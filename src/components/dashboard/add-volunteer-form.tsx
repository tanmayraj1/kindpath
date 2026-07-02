"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { addVolunteer, type VolunteerState } from "@/app/(dashboard)/dashboard/volunteers/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: VolunteerState = {};

export function AddVolunteerForm() {
  const [state, action] = useFormState(addVolunteer, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Volunteer added. Temporary password:{" "}
          <span className="font-mono font-semibold">{state.tempPassword}</span> — they can sign in
          at /login.
        </div>
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
          <Input id="v-email" name="email" type="email" required />
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
