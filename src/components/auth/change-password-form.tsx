"use client";

import { useFormState } from "react-dom";
import { changePasswordAction, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "./submit-button";

const initial: AuthState = {};

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(changePasswordAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      <div className="flex flex-col gap-2">
        <Label htmlFor="current">Current password</Label>
        <Input
          id="current"
          name="current"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!state.error}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          aria-describedby="new-password-hint"
          required
        />
        <p id="new-password-hint" className="text-xs text-muted-foreground">
          At least 10 characters, and different from your current one.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm">Confirm new password</Label>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <SubmitButton size="lg" className="mt-2 w-full">
        Update password
      </SubmitButton>
    </form>
  );
}
