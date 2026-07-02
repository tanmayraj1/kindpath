"use client";

import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";
import { verifyTwoFactorAction, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

const initial: AuthState = {};

export function TwoFactorForm() {
  const [state, formAction] = useFormState(verifyTwoFactorAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">Authentication code</Label>
        <Input
          id="code"
          name="code"
          inputMode="text"
          autoComplete="one-time-code"
          placeholder="123456"
          autoFocus
          required
        />
      </div>
      <SubmitButton size="lg" className="mt-2 w-full">
        Verify
      </SubmitButton>
    </form>
  );
}
