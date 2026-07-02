"use client";

import { useState } from "react";
import Link from "next/link";
import { useFormState } from "react-dom";
import { AlertCircle, Check } from "lucide-react";
import {
  saveOrgProfile,
  saveBranding,
  choosePlan,
  type OnboardingState,
} from "@/app/(dashboard)/dashboard/onboarding/actions";
import { PLANS, planPrice, type PlanKey, type CycleKey } from "@/lib/plans";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn } from "@/lib/utils";

const initial: OnboardingState = {};

function ErrorBanner({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" />
      {error}
    </div>
  );
}

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
      <ErrorBanner error={state.error} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="charityStatus">Is your organization a CRA-registered charity?</Label>
        <select
          id="charityStatus"
          name="charityStatus"
          defaultValue={props.charityStatus}
          onChange={(e) => setStatus(e.target.value as "registered" | "non_registered")}
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          <option value="non_registered">
            No — we&apos;ll send donors payment confirmations
          </option>
          <option value="registered">
            Yes — we issue official CRA donation receipts
          </option>
        </select>
        <p className="text-xs text-muted-foreground">
          Only registered charities may issue official donation receipts. You can change this
          later in Settings.
        </p>
      </div>

      {status === "registered" && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="craRegistrationNumber">CRA registration number (BN/RR)</Label>
            <Input
              id="craRegistrationNumber"
              name="craRegistrationNumber"
              placeholder="123456789 RR 0001"
              defaultValue={props.craRegistrationNumber ?? ""}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="authorizedSignatory">Authorized signatory</Label>
            <Input
              id="authorizedSignatory"
              name="authorizedSignatory"
              placeholder="Rev. Thomas Allen"
              defaultValue={props.authorizedSignatory ?? ""}
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="addressLine1">Street address</Label>
        <Input
          id="addressLine1"
          name="addressLine1"
          placeholder="123 Faith Street"
          defaultValue={props.addressLine1 ?? ""}
          required
        />
        <p className="text-xs text-muted-foreground">
          Your address appears on every receipt — the CRA requires it for registered charities.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" placeholder="Toronto" defaultValue={props.city ?? ""} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="province">Province</Label>
          <Input id="province" name="province" placeholder="ON" defaultValue={props.province ?? ""} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input
            id="postalCode"
            name="postalCode"
            placeholder="M5V 2T6"
            defaultValue={props.postalCode ?? ""}
            required
          />
        </div>
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
  const [color, setColor] = useState(props.primaryColor ?? "#4f46e5");

  return (
    <form action={action} className="flex flex-col gap-5">
      <ErrorBanner error={state.error} />

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="primaryColor">Brand color (hex)</Label>
          <div className="flex items-center gap-2">
            <Input
              id="primaryColor"
              name="primaryColor"
              placeholder="#4f46e5"
              defaultValue={props.primaryColor ?? ""}
              onChange={(e) => setColor(e.target.value)}
            />
            <span
              aria-hidden
              className="size-9 shrink-0 rounded-lg border border-border"
              style={{ background: /^#?[0-9a-fA-F]{6}$/.test(color) ? (color.startsWith("#") ? color : `#${color}`) : "#4f46e5" }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="logoUrl">Logo URL (https)</Label>
          <Input
            id="logoUrl"
            name="logoUrl"
            placeholder="https://…/logo.png"
            defaultValue={props.logoUrl ?? ""}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="receiptMessage">Thank-you message on receipts</Label>
        <Input
          id="receiptMessage"
          name="receiptMessage"
          placeholder="Thank you for supporting our community."
          defaultValue={props.receiptMessage ?? ""}
        />
      </div>

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
      <ErrorBanner error={state.error} />
      <input type="hidden" name="plan" value={plan} />
      <input type="hidden" name="cycle" value={cycle} />

      <div className="flex items-center gap-1 self-start rounded-full border border-border p-1 text-sm">
        {(["monthly", "annual"] as const).map((c) => (
          <button
            key={c}
            type="button"
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
                "flex flex-col gap-3 rounded-xl border p-5 text-left transition-all",
                selected
                  ? "border-brand-500 bg-brand-50/50 ring-2 ring-brand-500/30"
                  : "border-border hover:border-brand-300"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-display font-bold">{p.name}</span>
                {selected && (
                  <span className="grid size-5 place-items-center rounded-full bg-brand-600 text-white">
                    <Check className="size-3.5" />
                  </span>
                )}
              </div>
              <div>
                <span className="font-display text-2xl font-bold">
                  ${planPrice(p.key, cycle)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {" "}
                  CAD / {cycle === "annual" ? "year" : "month"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{p.blurb}</p>
              <ul className="flex flex-col gap-1.5">
                {p.highlights.map((h) => (
                  <li key={h} className="flex items-start gap-1.5 text-xs">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-success" /> {h}
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
        <SubmitButton>Finish setup</SubmitButton>
      </div>
    </form>
  );
}
