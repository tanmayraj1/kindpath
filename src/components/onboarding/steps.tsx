"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormState } from "react-dom";
import { Check } from "lucide-react";
import {
  saveOrgProfile,
  saveBranding,
  choosePlan,
  finishOnboarding,
  skipGatewayAndFinish,
  type OnboardingState,
} from "@/app/(dashboard)/dashboard/onboarding/actions";
import { PLANS, planPrice, type PlanKey, type CycleKey } from "@/lib/plans";
import { PROVINCES } from "@/lib/tax";
import { BRAND_HEX } from "@/lib/brand";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { ActionButton } from "@/components/ui/action-button";
import { GatewayForm, type GatewaySummary } from "@/components/dashboard/gateway-form";
import { cn } from "@/lib/utils";

const initial: OnboardingState = {};

// Same shape as Input (src/components/ui/input.tsx) — there is no Select
// primitive in the kit, so the native control borrows the input's chrome.
const selectCls =
  "flex h-11 w-full rounded-input border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

// ---------------- step 1 ----------------
export function OrgProfileStep(props: {
  charityStatus: "registered" | "non_registered";
  craRegistrationNumber?: string | null;
  authorizedSignatory?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
}) {
  const [state, action] = useFormState(saveOrgProfile, initial);
  const [status, setStatus] = useState(props.charityStatus);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert>{state.error}</FormAlert>}

      <div className="flex flex-col gap-2">
        <Label htmlFor="charityStatus">Is your organization a CRA-registered charity?</Label>
        <select
          id="charityStatus"
          name="charityStatus"
          defaultValue={props.charityStatus}
          onChange={(e) => setStatus(e.target.value as "registered" | "non_registered")}
          className={selectCls}
        >
          <option value="non_registered">No — we&apos;ll send donors payment confirmations</option>
          <option value="registered">Yes — we issue official CRA donation receipts</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Only registered charities may issue official donation receipts. You can change this
          later in Settings.
        </p>
      </div>

      {status === "registered" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            name="craRegistrationNumber"
            label="CRA registration number (BN/RR)"
            placeholder="123456789 RR 0001"
            defaultValue={props.craRegistrationNumber ?? ""}
            errors={state.fields}
          />
          <Field
            name="authorizedSignatory"
            label="Authorized signatory"
            placeholder="Rev. Thomas Allen"
            defaultValue={props.authorizedSignatory ?? ""}
            errors={state.fields}
          />
        </div>
      )}

      <Field
        name="addressLine1"
        label="Street address"
        placeholder="123 Faith Street"
        defaultValue={props.addressLine1 ?? ""}
        required
        autoComplete="street-address"
        errors={state.fields}
        hint="Your address appears on every receipt — the CRA requires it for registered charities."
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          name="city"
          label="City"
          placeholder="Toronto"
          defaultValue={props.city ?? ""}
          required
          autoComplete="address-level2"
          errors={state.fields}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="province">Province</Label>
          <select
            id="province"
            name="province"
            defaultValue={props.province ?? ""}
            required
            autoComplete="address-level1"
            aria-invalid={state.fields?.province ? true : undefined}
            className={selectCls}
          >
            <option value="" disabled>
              Choose…
            </option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
          {state.fields?.province && (
            <p className="text-xs font-medium text-destructive">{state.fields.province}</p>
          )}
        </div>
        <Field
          name="postalCode"
          label="Postal code"
          placeholder="M5V 2T6"
          defaultValue={props.postalCode ?? ""}
          required
          autoComplete="postal-code"
          errors={state.fields}
        />
      </div>

      <div>
        <SubmitButton>Continue</SubmitButton>
      </div>
    </form>
  );
}

// ---------------- step 2 ----------------
export function BrandingStep(props: {
  primaryColor?: string | null;
  logoUrl?: string | null;
  receiptMessage?: string | null;
}) {
  const [state, action] = useFormState(saveBranding, initial);
  const [color, setColor] = useState(props.primaryColor ?? BRAND_HEX);
  const swatch = /^#?[0-9a-fA-F]{6}$/.test(color)
    ? color.startsWith("#")
      ? color
      : `#${color}`
    : BRAND_HEX;

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert>{state.error}</FormAlert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="primaryColor">Brand color (hex)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primaryColor"
              name="primaryColor"
              placeholder={BRAND_HEX}
              defaultValue={props.primaryColor ?? ""}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={state.fields?.primaryColor ? true : undefined}
            />
            <span
              aria-hidden
              className="size-11 shrink-0 rounded-input border border-border"
              style={{ background: swatch }}
            />
          </div>
          {state.fields?.primaryColor && (
            <p className="text-xs font-medium text-destructive">{state.fields.primaryColor}</p>
          )}
        </div>
        <Field
          name="logoUrl"
          label="Logo URL (https)"
          placeholder="https://…/logo.png"
          defaultValue={props.logoUrl ?? ""}
          inputMode="url"
          errors={state.fields}
        />
      </div>

      <Field
        name="receiptMessage"
        label="Thank-you message on receipts"
        placeholder="Thank you for supporting our community."
        defaultValue={props.receiptMessage ?? ""}
        errors={state.fields}
      />

      <p className="text-xs text-muted-foreground">
        These appear on your public donation page, receipts and emails. All of it can be changed
        later in Settings.
      </p>

      <div className="flex items-center gap-3">
        <SubmitButton>Continue</SubmitButton>
        <Link
          href="/dashboard/onboarding?step=3"
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Skip for now
        </Link>
      </div>
    </form>
  );
}

// ---------------- step 3 ----------------
export function PlanStep(props: { plan: string; cycle: string }) {
  const [state, action] = useFormState(choosePlan, initial);
  const [plan, setPlan] = useState<PlanKey>(
    (PLANS.some((p) => p.key === props.plan) ? props.plan : "starter") as PlanKey
  );
  const [cycle, setCycle] = useState<CycleKey>(props.cycle === "annual" ? "annual" : "monthly");

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />

      <div
        role="radiogroup"
        aria-label="Billing period"
        className="flex items-center gap-1 self-start rounded-full border border-border p-1 text-sm"
      >
        {(["monthly", "annual"] as const).map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cycle === c}
            onClick={() => setCycle(c)}
            className={cn(
              "rounded-full px-3.5 py-1.5 font-medium transition-colors",
              cycle === c ? "bg-brand-600 text-white" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {c === "monthly" ? "Monthly" : "Annual · 2 months free"}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const selected = plan === p.key;
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setPlan(p.key)}
              aria-pressed={selected}
              className={cn(
                "flex flex-col gap-3 rounded-card border p-5 text-left transition-all",
                selected
                  ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/30"
                  : "border-border hover:border-brand-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold">{p.name}</span>
                {selected && (
                  <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                    <Check className="size-3.5" aria-hidden />
                  </span>
                )}
              </div>
              <div>
                <span className="font-display text-2xl font-bold tnum">${planPrice(p.key, cycle)}</span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  CAD / {cycle === "annual" ? "year" : "month"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{p.blurb}</p>
              <ul className="flex flex-col gap-1.5">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5 text-xs">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden /> {h}
                  </li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        Your 14-day free trial applies to any plan — you won&apos;t be charged until it ends, and
        you can switch plans anytime.
      </p>

      <div>
        <SubmitButton>Continue</SubmitButton>
      </div>
    </form>
  );
}

// ---------------- step 4 ----------------
/**
 * The step that decides whether the product works. Everything before this is
 * paperwork; without a gateway the giving page runs on KindPath's platform
 * account and the charity never sees the money. The connect form is the same
 * one Settings uses — the only thing added here is the finish/skip decision,
 * and the skip is deliberately a confirmed button rather than a quiet link.
 */
export function GatewayStep({ summary }: { summary: GatewaySummary }) {
  const router = useRouter();
  const [state, action] = useFormState(finishOnboarding, initial);
  const connected = summary.configured && !summary.error;

  return (
    <div className="flex flex-col gap-6">
      <GatewayForm summary={summary} />

      <div className="h-px bg-border" aria-hidden />

      <form action={action} className="flex flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <div className="flex flex-wrap items-center gap-3">
          {/* Spread rather than disabled={!connected}: SubmitButton spreads props
              after its own pending-disable, so an explicit `false` would re-enable
              the button mid-submit. */}
          <SubmitButton {...(connected ? {} : { disabled: true })}>Finish setup</SubmitButton>
          {!connected && (
            <ActionButton
              variant="ghost"
              action={skipGatewayAndFinish}
              onDone={(r) => {
                if (r.ok) router.push("/dashboard/onboarding/done");
              }}
              confirm={{
                title: "Finish without a payment gateway?",
                description:
                  "Your giving page will be live, but donations made there will run on KindPath's platform account and will not reach your bank. You can connect Stripe any time from Settings → Payments.",
                confirmLabel: "Finish without a gateway",
              }}
            >
              Skip for now
            </ActionButton>
          )}
        </div>
        {!connected && (
          <p className="text-xs text-muted-foreground">
            No Stripe account yet? Creating one takes a few minutes at stripe.com. Test keys work
            here too — no real money moves until you swap in a live key.
          </p>
        )}
      </form>
    </div>
  );
}
