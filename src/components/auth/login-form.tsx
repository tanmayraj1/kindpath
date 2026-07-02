"use client";

import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";
import { loginAction, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

const initial: AuthState = {};

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" placeholder="you@organization.org" autoComplete="email" required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" placeholder="••••••••" autoComplete="current-password" required />
      </div>
      <SubmitButton size="lg" className="mt-2 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
