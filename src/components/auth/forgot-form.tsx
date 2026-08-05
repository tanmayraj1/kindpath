"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { requestPasswordReset, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "./submit-button";

const initial: AuthState & { sent?: boolean } = {};

export function ForgotForm() {
  const [state, formAction] = useFormState(requestPasswordReset, initial);

  // Deliberately the same confirmation whether or not the address has an
  // account — the form must not reveal who is registered on the platform.
  if (state.sent) {
    return (
      <div className="flex flex-col gap-4">
        <FormAlert variant="success">
          If an account exists for that address, we&apos;ve sent a reset link. It expires in one hour.
        </FormAlert>
        <p className="text-sm text-muted-foreground">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <Link href="/forgot" className="font-medium text-brand-600 hover:underline">
            try again
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@organization.org"
          autoComplete="email"
          aria-invalid={!!state.error}
          required
        />
      </div>
      <SubmitButton size="lg" className="mt-2 w-full">
        Send reset link
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
