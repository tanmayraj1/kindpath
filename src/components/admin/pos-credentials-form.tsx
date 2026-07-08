"use client";

import { useTransition } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, ShieldCheck, Trash2 } from "lucide-react";
import { savePosCredentials, clearPosCredentials, type AdminState } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: AdminState = {};

export function PosCredentialsForm({
  orgId,
  configured,
  midTail,
  email,
  termId,
}: {
  orgId: string;
  configured: boolean;
  midTail?: string;
  email?: string;
  termId?: string;
}) {
  const [state, action] = useFormState(savePosCredentials, initial);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {(configured || state.ok) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-success">
            <ShieldCheck className="size-4 shrink-0" />
            WeVend merchant configured
            {midTail && <span className="text-muted-foreground">· MID ****{midTail} · {email} · term {termId}</span>}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            onClick={() => start(() => clearPosCredentials(orgId))}
          >
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
      )}

      <form action={action} className="flex flex-col gap-4">
        {state.error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" /> {state.error}
          </div>
        )}
        {state.ok && (
          <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" /> Credentials encrypted and saved.
          </div>
        )}

        <input type="hidden" name="orgId" value={orgId} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-mid">Merchant ID (MID)</Label>
            <Input id="pos-mid" name="mid" placeholder="RCTST1234567890" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-termId">Terminal ID</Label>
            <Input id="pos-termId" name="termId" placeholder="00000003" required />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-email">Merchant email</Label>
            <Input id="pos-email" name="email" type="email" placeholder="merchant@org.ca" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="pos-password">Merchant password</Label>
            <Input id="pos-password" name="password" type="password" autoComplete="new-password" required />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Stored encrypted (AES-256-GCM) — never in plaintext, never in logs. Used to authenticate
          this organization&apos;s own WeVend merchant account when PAYMENT_PROVIDER=wevend.
        </p>
        <div>
          <SubmitButton>{configured ? "Replace credentials" : "Save credentials"}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
