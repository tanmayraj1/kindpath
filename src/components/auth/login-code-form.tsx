"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { AlertCircle, MailCheck } from "lucide-react";
import {
  requestLoginCodeAction,
  verifyLoginCodeAction,
  type CodeState,
} from "@/app/(auth)/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "./submit-button";

const initial: CodeState = {};

/**
 * Two-step passwordless sign-in: ask for the address, then for the code.
 *
 * Both steps live in one component so the email typed in step one can be carried
 * into step two without a round trip or a cookie. It is submitted as a hidden
 * field and re-resolved server-side after the code verifies — the client's copy
 * is a convenience, never the authority.
 *
 * The "sent" screen is shown for ANY successful request, including an address
 * with no account. The server deliberately can't tell the two apart, and a UI
 * that did would hand back the enumeration oracle the server just refused.
 */
export function LoginCodeForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [requestState, requestAction] = useFormState(requestLoginCodeAction, initial);
  const [verifyState, verifyAction] = useFormState(verifyLoginCodeAction, initial);

  if (requestState.sent) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-input border border-brand-200 bg-brand-50/60 px-3.5 py-3 text-sm">
          <MailCheck className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden />
          <p>
            If that address is on file, a 6-digit code is on its way. It expires in 10 minutes.
          </p>
        </div>

        <form action={verifyAction} className="flex flex-col gap-4">
          {verifyState.error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-input border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
            >
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              {verifyState.error}
            </div>
          )}
          <input type="hidden" name="email" value={email} />
          {next && <input type="hidden" name="next" value={next} />}
          <div className="flex flex-col gap-2">
            <Label htmlFor="code">6-digit code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              // Lets iOS and Android offer the code straight from the SMS/mail
              // notification instead of making the reader switch apps to copy it.
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="123456"
              className="tnum text-center text-2xl tracking-[0.4em]"
              autoFocus
              required
            />
          </div>
          <SubmitButton size="lg" className="mt-1 w-full">
            Sign in
          </SubmitButton>
        </form>

        <form action={requestAction}>
          <input type="hidden" name="email" value={email} />
          <button
            type="submit"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            Send a new code
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={requestAction} className="flex flex-col gap-4">
      {requestState.error && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-input border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertCircle className="size-4 shrink-0" aria-hidden />
          {requestState.error}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="code-email">Email</Label>
        <Input
          id="code-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          required
        />
      </div>
      <SubmitButton size="lg" className="mt-1 w-full">
        Email me a code
      </SubmitButton>
    </form>
  );
}
