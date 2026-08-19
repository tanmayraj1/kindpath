"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { loginAction, type AuthState } from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "./submit-button";

const initial: AuthState = {};

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useFormState(loginAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* Carried so a deep link survives sign-in. Attacker-controllable, so it is
          validated server-side by safeNext — never trusted from here. */}
      {next && <input type="hidden" name="next" value={next} />}
      <FormAlert>{state.error}</FormAlert>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={!!state.error}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot" className="text-xs font-medium text-brand-600 hover:underline">
            Forgot password?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          autoComplete="current-password"
          aria-invalid={!!state.error}
          required
        />
      </div>
      <SubmitButton size="lg" className="mt-2 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
