"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { resetPasswordAction, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "./submit-button";

const initial: AuthState & { ok?: boolean } = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction] = useFormState(resetPasswordAction, initial);

  if (state.ok) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert variant="success">
          Your password has been changed, and any other devices signed in to this account
          have been signed out.
        </FormAlert>
        <Link
          href="/login"
          className="text-center text-sm font-medium text-brand-600 hover:underline"
        >
          Sign in with your new password
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          aria-describedby="password-hint"
          aria-invalid={!!state.error}
          required
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          At least 10 characters. A short phrase you&apos;ll remember beats a short jumble.
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
        Set new password
      </SubmitButton>
    </form>
  );
}
