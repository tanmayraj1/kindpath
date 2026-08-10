"use client";

import { useState, useTransition } from "react";
import { useFormState } from "react-dom";
import { ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import { savePosCredentials, clearPosCredentials, type AdminState } from "@/app/admin/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: AdminState = {};

const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Connect a charity's OWN gateway account, so donations settle directly to them
 * rather than through KindPath.
 */
export function PosCredentialsForm({
  orgId,
  configured,
  provider,
  error,
  midTail,
  email,
  wvNumber,
  termId,
  keyTail,
  liveMode,
}: {
  orgId: string;
  configured: boolean;
  provider?: "wevend" | "stripe";
  error?: string;
  midTail?: string;
  email?: string;
  wvNumber?: string;
  termId?: string;
  keyTail?: string;
  liveMode?: boolean;
}) {
  const [state, action] = useFormState(savePosCredentials, initial);
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<"wevend" | "stripe">(provider ?? "stripe");

  return (
    <div className="flex flex-col gap-4">
      {/* Credentials stored but undecryptable is its own state: charging refuses
          outright rather than silently using a different merchant account. */}
      {error && (
        <FormAlert>
          <span className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            {error} Payments for this organization are refused until it&apos;s re-entered.
          </span>
        </FormAlert>
      )}

      {configured && !error && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm">
          <span className="flex items-center gap-2 text-success">
            <ShieldCheck className="size-4 shrink-0" aria-hidden />
            {provider === "stripe" ? "Stripe account connected" : "WeVend merchant configured"}
            <span className="text-muted-foreground">
              {provider === "stripe"
                ? `· key ····${keyTail} · ${liveMode ? "LIVE mode" : "test mode"}`
                : `· MID ****${midTail} · ${wvNumber ?? email} · term ${termId}`}
            </span>
          </span>
          <ConfirmButton
            size="sm"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10"
            disabled={pending}
            title="Remove these gateway credentials?"
            description="This organization falls back to the platform default gateway. If that isn't configured, their donation page stops taking payments."
            confirmLabel="Remove"
            destructive
            onConfirm={() => start(() => clearPosCredentials(orgId))}
          >
            <Trash2 className="size-4" aria-hidden /> Remove
          </ConfirmButton>
        </div>
      )}

      <form action={action} className="flex flex-col gap-4">
        <FormAlert>{state.error}</FormAlert>
        {state.ok && <FormAlert variant="success">Credentials encrypted and saved.</FormAlert>}

        <input type="hidden" name="orgId" value={orgId} />

        <div className="flex max-w-xs flex-col gap-2">
          <Label htmlFor="provider">Gateway</Label>
          <select
            id="provider"
            name="provider"
            value={selected}
            onChange={(e) => setSelected(e.target.value as "wevend" | "stripe")}
            className={selectCls}
          >
            <option value="stripe">Stripe</option>
            <option value="wevend">WeVend WePay</option>
          </select>
        </div>

        {selected === "stripe" ? (
          <>
            <Field
              name="secretKey"
              label="Stripe secret key"
              type="password"
              placeholder="sk_test_… or sk_live_…"
              autoComplete="off"
              errors={state.fields}
              hint="From the charity's own Stripe account, so payouts go directly to them. Use a test key until you've run a live $1 charge."
              required
            />
            <Field
              name="stripeWebhookSecret"
              label="Webhook signing secret (optional)"
              type="password"
              placeholder="whsec_…"
              autoComplete="off"
              errors={state.fields}
              hint="Needed for refunds made in Stripe's dashboard to void the matching tax receipt here."
            />
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field name="mid" label="Merchant ID (MID)" placeholder="RCTST1234567890" errors={state.fields} />
              <Field name="termId" label="Terminal ID" placeholder="00000003" errors={state.fields} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="email"
                label="Merchant email"
                type="email"
                placeholder="merchant@org.ca"
                errors={state.fields}
                hint="Merchant-mode auth. Leave blank if using an organization (WV) number."
              />
              <Field
                name="wvNumber"
                label="Organization (WV) number"
                placeholder="WV-ISV-50001"
                errors={state.fields}
                hint="ISV-mode auth. Use instead of a merchant email."
              />
            </div>
            <div className="max-w-xs">
              <Field
                name="password"
                label="Merchant password"
                type="password"
                autoComplete="new-password"
                errors={state.fields}
              />
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground">
          Stored encrypted (AES-256-GCM) — never in plaintext, never in logs, never in the audit
          trail. Only that credentials changed is recorded.
        </p>
        <div>
          <SubmitButton>{configured ? "Replace credentials" : "Save credentials"}</SubmitButton>
        </div>
      </form>
    </div>
  );
}
