"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, TriangleAlert } from "lucide-react";
import { connectStripeAccount, disconnectGateway, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";
import { ActionButton } from "@/components/ui/action-button";

const initial: ActionState = {};

export type GatewaySummary = {
  configured: boolean;
  provider?: "wevend" | "stripe";
  error?: string;
  keyTail?: string;
  liveMode?: boolean;
  midTail?: string;
};

/**
 * Connect the organization's own payment gateway.
 *
 * The status block is the point of this component, not the form. Before it
 * existed an org had no way to tell whether donations were running on its own
 * Stripe account or on KindPath's platform fallback — and those settle into
 * different bank accounts. "Not connected" has to be legible, not inferred.
 */
export function GatewayForm({ summary }: { summary: GatewaySummary }) {
  const [state, formAction] = useFormState(connectStripeAccount, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the field once the key is stored. It is sealed server-side and the UI
  // tells the user it is "never shown again" — leaving the plaintext secret
  // sitting in the input contradicts that, keeps it readable in devtools, and
  // leaves it in the DOM for anything that later serialises the form.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── current state ───────────────────────────────────────────── */}
      {summary.configured && summary.error ? (
        <div className="flex items-start gap-3 rounded-input border border-destructive/25 bg-destructive/5 px-3.5 py-3 text-sm">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
          <div>
            <p className="font-semibold text-destructive">Gateway credentials unreadable</p>
            <p className="text-muted-foreground">
              Donations are refused rather than falling back, so nothing is charged to the wrong
              account. Reconnect below.
            </p>
          </div>
        </div>
      ) : summary.configured ? (
        <div className="flex items-start gap-3 rounded-input border border-success/25 bg-success/5 px-3.5 py-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
          <div className="min-w-0">
            <p className="font-semibold">
              Connected to your own {summary.provider === "stripe" ? "Stripe" : "WeVend"} account
            </p>
            <p className="tnum text-muted-foreground">
              {summary.provider === "stripe"
                ? `Key ending ${summary.keyTail} · ${summary.liveMode ? "Live mode" : "Test mode"}`
                : `Merchant ending ${summary.midTail}`}
            </p>
            {summary.provider === "stripe" && !summary.liveMode && (
              <p className="mt-1 text-xs text-warning-foreground">
                Test mode accepts test cards only — no real money moves. Swap in your live key
                when you&apos;re ready to receive donations.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-input border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-foreground" aria-hidden />
          <div>
            <p className="font-semibold">No gateway connected</p>
            <p className="text-muted-foreground">
              Until you connect one, donations run on KindPath&apos;s platform account and do not
              settle to you. Connect your own Stripe account to receive money directly.
            </p>
          </div>
        </div>
      )}

      {/* ── connect ─────────────────────────────────────────────────── */}
      <form ref={formRef} action={formAction} className="flex flex-col gap-4">
        {state.error && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-input border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {state.error}
          </div>
        )}
        {state.ok && (
          <div className="flex items-center gap-2 rounded-input border border-success/25 bg-success/5 px-3 py-2.5 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            Connected. Donations now settle to your account.
          </div>
        )}

        <Field
          name="secretKey"
          label="Stripe secret key"
          type="password"
          autoComplete="off"
          placeholder="sk_live_…"
          required
          errors={state.fields}
        />

        <Field
          name="webhookSecret"
          label="Webhook signing secret (optional)"
          type="password"
          autoComplete="off"
          placeholder="whsec_…"
          errors={state.fields}
        />

        <p className="text-xs leading-relaxed text-muted-foreground">
          Both come from your Stripe dashboard under{" "}
          <span className="font-medium">Developers</span>. The key is encrypted before it is
          stored and is never shown again — we keep only the last four characters so you can tell
          two accounts apart.{" "}
          <a
            href="https://dashboard.stripe.com/apikeys"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline"
          >
            Open Stripe
            <ExternalLink className="size-3" aria-hidden />
          </a>
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>{summary.configured ? "Replace credentials" : "Connect account"}</SubmitButton>
          {summary.configured && (
            <ActionButton
              action={disconnectGateway}
              variant="outline"
              confirm={{
                title: "Disconnect this gateway?",
                description:
                  "New donations will fall back to KindPath's platform account until you connect one again. Existing receipts and giving history are untouched.",
                confirmLabel: "Disconnect",
                destructive: true,
              }}
            >
              Disconnect
            </ActionButton>
          )}
        </div>
      </form>
    </div>
  );
}
