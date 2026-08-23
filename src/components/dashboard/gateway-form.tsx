"use client";

import { useFormState } from "react-dom";
import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, ExternalLink, TriangleAlert } from "lucide-react";
import {
  connectStripeAccount,
  connectWeVendAccount,
  disconnectGateway,
  type ActionState,
} from "@/app/(dashboard)/dashboard/actions";
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

export type GatewayEnvironment = "sandbox" | "production" | "unknown";

/**
 * Connect the organization's own payment gateway.
 *
 * The status block is the point of this component, not the form. Before it
 * existed an org had no way to tell whether donations were running on its own
 * merchant account or on KindPath's platform fallback — and those settle into
 * different bank accounts. "Not connected" has to be legible, not inferred.
 *
 * `offered` decides which connect form renders (src/lib/payments/offered.ts).
 * WeVend is what charities are offered; the Stripe form is kept for the day the
 * constant flips back. `environment` is the platform's WeVend host — per-org
 * credentials don't carry it, and a production merchant on a sandbox-pointed
 * platform would "connect" and fail at the first gift, so it is shown.
 */
export function GatewayForm({
  summary,
  offered = "wevend",
  environment = "unknown",
  orgToken = false,
}: {
  summary: GatewaySummary;
  offered?: "wevend" | "stripe";
  environment?: GatewayEnvironment;
  /**
   * The platform holds WeVend organization credentials, so this merchant is
   * addressed by MID under that organization and the charity's own WePay
   * password is not needed — and therefore is not asked for.
   */
  orgToken?: boolean;
}) {
  const connectAction = offered === "stripe" ? connectStripeAccount : connectWeVendAccount;
  const [state, formAction] = useFormState(connectAction, initial);
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the fields once credentials are stored. They are sealed server-side
  // and the UI tells the user they are "never shown again" — leaving the
  // plaintext in the inputs contradicts that and keeps it readable in devtools.
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  const providerLabel = offered === "stripe" ? "Stripe" : "WeVend";
  const envLabel =
    environment === "sandbox" ? "Sandbox" : environment === "production" ? "Production" : null;

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
              Connected to your own {summary.provider === "stripe" ? "Stripe account" : "WeVend merchant"}
            </p>
            <p className="tnum text-muted-foreground">
              {summary.provider === "stripe"
                ? `Key ending ${summary.keyTail} · ${summary.liveMode ? "Live mode" : "Test mode"}`
                : `Merchant ending ${summary.midTail}${envLabel ? ` · ${envLabel}` : ""}`}
            </p>
            {summary.provider === "stripe" && !summary.liveMode && (
              <p className="mt-1 text-xs text-warning-foreground">
                Test mode accepts test cards only — no real money moves. Swap in your live key
                when you&apos;re ready to receive donations.
              </p>
            )}
            {summary.provider === "wevend" && environment === "sandbox" && (
              <p className="mt-1 text-xs text-warning-foreground">
                The platform is pointed at WeVend&apos;s sandbox — test cards only, no real money
                moves.
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
              settle to you. Connect your own {providerLabel} merchant account to receive money
              directly.
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

        {offered === "stripe" ? (
          <>
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
              stored and is never shown again — we keep only the last four characters so you can
              tell two accounts apart.{" "}
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
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                name="mid"
                label="Merchant ID (MID)"
                autoComplete="off"
                placeholder="RCTST1234567890"
                required
                errors={state.fields}
              />
              <Field
                name="termId"
                label="Terminal ID"
                autoComplete="off"
                placeholder="00000003"
                required
                errors={state.fields}
                hint="From your WeVend merchant profile; usually 00000003."
              />
            </div>
            {!orgToken && (
              <>
                <Field
                  name="email"
                  label="WeVend login email"
                  type="email"
                  autoComplete="off"
                  placeholder="treasurer@yourorg.ca"
                  required
                  errors={state.fields}
                />
                <Field
                  name="password"
                  label="WeVend password"
                  type="password"
                  autoComplete="new-password"
                  required
                  errors={state.fields}
                />
              </>
            )}
            <p className="text-xs leading-relaxed text-muted-foreground">
              {orgToken ? (
                <>
                  These are on the merchant details WeVend sent you. We check the merchant ID with
                  WeVend before saving. <span className="font-medium">We never ask for your
                  WeVend password</span> — your account stays yours; KindPath is authorized to
                  bill through it as your provider.
                </>
              ) : (
                <>
                  These are the merchant details WeVend gave you when your account was set up. We
                  check them with WeVend before saving, then encrypt them — they are never shown
                  again; only the last four characters of the merchant ID are kept visible so you
                  can tell two accounts apart.
                </>
              )}
              {envLabel && (
                <>
                  {" "}
                  This platform is connected to WeVend&apos;s{" "}
                  <span className="font-medium">{envLabel.toLowerCase()}</span> environment.
                </>
              )}
            </p>
          </>
        )}

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
