"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, ShieldCheck, Copy } from "lucide-react";
import {
  beginTwoFactorSetup,
  activateTwoFactor,
  disableTwoFactor,
  type ActivateState,
  type DisableState,
} from "@/app/(dashboard)/dashboard/security/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const activateInitial: ActivateState = {};
const disableInitial: DisableState = {};

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [activate, activateAction] = useFormState(activateTwoFactor, activateInitial);
  const [disable, disableAction] = useFormState(disableTwoFactor, disableInitial);

  // Enabled + just finished disabling → reflect immediately.
  const isEnabled = disable.ok ? false : enabled || activate.ok;

  if (isEnabled && !activate.recoveryCodes) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <ShieldCheck className="size-4 shrink-0" />
          Two-factor authentication is <span className="font-semibold">on</span> for your account.
        </div>
        <form action={disableAction} className="flex max-w-sm flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            To turn it off, enter a current code from your authenticator app.
          </p>
          {disable.error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {disable.error}
            </div>
          )}
          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1">
              <Label htmlFor="disable-code">Current code</Label>
              <Input id="disable-code" name="code" placeholder="123456" autoComplete="one-time-code" required />
            </div>
            <SubmitButton variant="destructive">Disable</SubmitButton>
          </div>
        </form>
      </div>
    );
  }

  // Just activated → show recovery codes once.
  if (activate.recoveryCodes) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Two-factor authentication is now enabled.
        </div>
        <div>
          <p className="text-sm font-medium">Save your recovery codes</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Each code works once if you lose your device. Store them somewhere safe — they won&apos;t
            be shown again.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-secondary/40 p-4 font-mono text-sm sm:grid-cols-2">
            {activate.recoveryCodes.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => navigator.clipboard?.writeText(activate.recoveryCodes!.join("\n"))}
          >
            <Copy className="size-4" /> Copy codes
          </Button>
        </div>
      </div>
    );
  }

  // Not enabled → start setup, then show QR + verify form.
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Add a second layer of security. You&apos;ll enter a code from an authenticator app (Google
        Authenticator, Authy, 1Password) each time you sign in.
      </p>

      {!setup ? (
        <div>
          {setupError && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" /> {setupError}
            </div>
          )}
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                setSetupError(null);
                const r = await beginTwoFactorSetup();
                if (r.error || !r.qr || !r.secret) {
                  setSetupError(r.error ?? "Could not start setup. Try again.");
                } else {
                  setSetup({ secret: r.secret, qr: r.qr });
                }
              })
            }
          >
            <ShieldCheck className="size-4" /> Enable two-factor authentication
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="Scan this QR code with your authenticator app" className="rounded-lg border border-border" />
            <p className="max-w-[220px] text-center text-xs text-muted-foreground">
              Can&apos;t scan? Enter this key manually:
            </p>
            <code className="break-all rounded bg-secondary px-2 py-1 text-center text-xs">{setup.secret}</code>
          </div>
          <form action={activateAction} className="flex flex-1 flex-col gap-3">
            <p className="text-sm">
              1. Scan the QR code with your app.
              <br />
              2. Enter the 6-digit code it shows to finish.
            </p>
            {activate.error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" /> {activate.error}
              </div>
            )}
            <div className="flex flex-col gap-1">
              <Label htmlFor="activate-code">Verification code</Label>
              <Input id="activate-code" name="code" placeholder="123456" autoComplete="one-time-code" autoFocus required />
            </div>
            <SubmitButton>Verify &amp; turn on</SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}
