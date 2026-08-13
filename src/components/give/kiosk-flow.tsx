"use client";

import { useEffect, useState } from "react";
import { useFormState } from "react-dom";
import { Heart, Loader2, AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";
import {
  authorizeCharge,
  beginHostedDonation,
  completeKioskDonation,
  type KioskCompleteState,
} from "@/app/give/[slug]/actions";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { formatCAD } from "@/lib/utils";

type Org = {
  name: string;
  slug: string;
  charityStatus: "registered" | "non_registered";
  funds: { id: string; name: string }[];
};

const PRESETS = [20, 50, 100, 250, 500, 1000];
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const initial: KioskCompleteState = {};
const RESET_SECONDS = 12;

type Step = "amount" | "details" | "thanks";

/**
 * Full-screen self-serve kiosk giving for tablets at in-person events.
 * Large touch targets, no navigation chrome, auto-resets to the amount screen
 * after each gift so the next person starts fresh. The receipt is emailed —
 * nothing personal is left on the shared screen.
 */
export function KioskFlow({ org, hosted }: { org: Org; hosted: boolean }) {
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState(0);
  const [fundId, setFundId] = useState(org.funds[0]?.id ?? "none");
  const [chargeRef, setChargeRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, action] = useFormState(completeKioskDonation, initial);
  const [countdown, setCountdown] = useState(RESET_SECONDS);

  function reset() {
    setStep("amount");
    setAmount(0);
    setFundId(org.funds[0]?.id ?? "none");
    setChargeRef("");
    setError(null);
    setCountdown(RESET_SECONDS);
  }

  // On successful completion, show thanks + auto-reset.
  useEffect(() => {
    if (state.ok) setStep("thanks");
  }, [state.ok]);

  useEffect(() => {
    if (step !== "thanks") return;
    if (countdown <= 0) {
      reset();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, countdown]);

  async function pay() {
    setError(null);
    setBusy(true);
    if (hosted) {
      // Hosted gateway (WeVend): hand off to its card page; it returns to /response.
      const res = await beginHostedDonation({
        slug: org.slug,
        amount,
        fundId: fundId !== "none" ? fundId : undefined,
        frequency: "one_time",
      });
      if (res.ok) {
        window.location.assign(res.redirectTo);
        return;
      }
      setBusy(false);
      setError(res.message);
      return;
    }
    const res = await authorizeCharge(org.slug, amount);
    setBusy(false);
    if (res.ok) {
      setChargeRef(res.chargeRef);
      setStep("details");
    } else {
      setError(res.message);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-8 p-8">
      {/* AMOUNT */}
      {step === "amount" && (
        <div className="flex w-full flex-col items-center gap-8">
          <div className="text-center">
            <span className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-brand-50 text-brand-600">
              <Heart className="size-8" />
            </span>
            <h1 className="font-display text-4xl font-bold sm:text-5xl">Give to {org.name}</h1>
            <p className="mt-2 text-lg text-muted-foreground">Tap an amount to donate</p>
          </div>

          <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
            {PRESETS.map((v) => (
              <button
                key={v}
                onClick={() => setAmount(v)}
                className={
                  "rounded-2xl border-2 py-8 text-3xl font-bold transition-all " +
                  (amount === v
                    ? "border-brand-500 bg-brand-50 text-brand-700 ring-4 ring-brand-500/20"
                    : "border-border hover:border-brand-300 hover:bg-secondary")
                }
              >
                ${v}
              </button>
            ))}
          </div>

          {org.funds.length > 1 && (
            <div className="flex w-full max-w-sm flex-col gap-2">
              <Label className="text-center text-base">Give to</Label>
              <select
                value={fundId}
                onChange={(e) => setFundId(e.target.value)}
                className="h-14 rounded-xl border-2 border-input bg-background px-4 text-lg"
              >
                {org.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive">
              <AlertCircle className="size-5 shrink-0" /> {error}
            </div>
          )}

          <Button
            size="lg"
            className="h-16 w-full max-w-sm text-xl"
            disabled={amount < 1 || busy}
            onClick={pay}
          >
            {busy && <Loader2 className="size-5 animate-spin" />}
            {amount >= 1 ? `Donate ${formatCAD(amount)}` : "Select an amount"}
          </Button>
        </div>
      )}

      {/* DETAILS (synchronous providers only; hosted flow leaves to the gateway) */}
      {step === "details" && (
        <form action={action} className="flex w-full max-w-lg flex-col gap-4">
          <div className="text-center">
            <span className="mx-auto mb-2 grid size-14 place-items-center rounded-2xl bg-success/10">
              <CheckCircle2 className="size-7 text-success" />
            </span>
            <h1 className="font-display text-3xl font-bold">Payment received</h1>
            <p className="mt-1 text-muted-foreground">
              Enter your details — your {org.charityStatus === "registered" ? "tax receipt" : "confirmation"} will
              be emailed.
            </p>
          </div>

          {state.error && (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive">
              <AlertCircle className="size-5 shrink-0" /> {state.error}
            </div>
          )}

          <input type="hidden" name="slug" value={org.slug} />
          <input type="hidden" name="chargeRef" value={chargeRef} />
          <input type="hidden" name="amount" value={amount} />
          <input type="hidden" name="fundId" value={fundId} />
          <input type="hidden" name="campaignId" value="none" />
          <input type="hidden" name="frequency" value="one_time" />

          {/* Touch targets stay at h-12 for kiosk use; the change here is that
              per-field errors are shown at all. Someone standing at a terminal in
              a foyer cannot be sent around the loop once per invalid field. */}
          <div className="grid grid-cols-2 gap-3">
            <Field name="firstName" label="First name" className="[&_input]:h-12 [&_input]:text-base" required errors={state.fields} />
            <Field name="lastName" label="Last name" className="[&_input]:h-12 [&_input]:text-base" required errors={state.fields} />
          </div>
          <Field name="email" label="Email" type="email" className="[&_input]:h-12 [&_input]:text-base" required errors={state.fields} />
          <Field
            name="addressLine1"
            label="Address"
            placeholder="Street address"
            className="[&_input]:h-12 [&_input]:text-base"
            required
            errors={state.fields}
          />
          <div className="grid grid-cols-3 gap-3">
            <Field name="city" label="City" className="col-span-1 [&_input]:h-12 [&_input]:text-base" required errors={state.fields} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="province">Prov.</Label>
              <select
                id="province"
                name="province"
                defaultValue="ON"
                aria-invalid={state.fields?.province ? true : undefined}
                className="h-12 rounded-lg border border-input bg-background px-2 text-base"
              >
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <Field name="postalCode" label="Postal" placeholder="A1A 1A1" className="[&_input]:h-12 [&_input]:text-base" required errors={state.fields} />
          </div>

          <div className="flex gap-3">
            <Button type="button" variant="outline" size="lg" className="h-14" onClick={reset}>
              Cancel
            </Button>
            <SubmitButton size="lg" className="h-14 flex-1 text-lg">
              Finish
            </SubmitButton>
          </div>
        </form>
      )}

      {/* THANKS */}
      {step === "thanks" && (
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="grid size-24 place-items-center rounded-full bg-success/10">
            <CheckCircle2 className="size-14 text-success" />
          </span>
          <h1 className="font-display text-4xl font-bold sm:text-5xl">Thank you! 🙏</h1>
          <p className="max-w-md text-xl text-muted-foreground">
            Your gift to {org.name} is complete. Your receipt is on its way by email.
          </p>
          <Button size="lg" className="h-14 text-lg" onClick={reset}>
            <RotateCcw className="size-5" /> Give again
          </Button>
          <p className="text-sm text-muted-foreground">Returning to start in {countdown}s…</p>
        </div>
      )}
    </div>
  );
}
