"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Heart, CreditCard, Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  authorizeCharge,
  beginHostedDonation,
  completeDonation,
  type CompleteState,
} from "@/app/give/[slug]/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn, formatCAD, estimateFee } from "@/lib/utils";

type Org = {
  id: string;
  name: string;
  slug: string;
  charityStatus: "registered" | "non_registered";
  funds: { id: string; name: string }[];
};

const PRESETS = [25, 50, 100, 250];
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const initialComplete: CompleteState = {};

export function DonationFlow({
  org,
  campaign,
  hosted = false,
}: {
  org: Org;
  campaign?: { id: string; title: string; fundId?: string | null };
  /** true when the provider uses a hosted card page (WeVend) — skips the in-app pay step */
  hosted?: boolean;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState(50);
  const [custom, setCustom] = useState("");
  const [fundId, setFundId] = useState(org.funds[0]?.id ?? "none");
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");
  const [chargeRef, setChargeRef] = useState("");
  const [charging, setCharging] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [coverFees, setCoverFees] = useState(true);

  const [completeState, completeFormAction] = useFormState(completeDonation, initialComplete);

  const baseAmount = custom ? Math.max(0, Number(custom) || 0) : amount;
  const fee = estimateFee(baseAmount);
  const effectiveAmount = coverFees ? Math.round((baseAmount + fee) * 100) / 100 : baseAmount;

  async function pay() {
    setPayError(null);
    setCharging(true);
    const res = await authorizeCharge(org.slug, effectiveAmount);
    setCharging(false);
    if (res.ok) {
      setChargeRef(res.chargeRef);
      setStep(3);
    } else {
      setPayError(res.message);
    }
  }

  /** Hosted gateways: create the order server-side, then hand off to the gateway's card page. */
  async function payHosted() {
    setPayError(null);
    setCharging(true);
    const res = await beginHostedDonation({
      slug: org.slug,
      amount: effectiveAmount,
      fundId: fundId !== "none" ? fundId : undefined,
      campaignId: campaign?.id,
      frequency,
    });
    if (res.ok) {
      window.location.assign(res.redirectTo);
    } else {
      setCharging(false);
      setPayError(res.message);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      {/* progress */}
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 w-10 rounded-full transition-colors",
              step >= n ? "bg-primary" : "bg-border"
            )}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        {/* STEP 1 — amount */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <Header
              icon={<Heart className="size-5" />}
              title={campaign ? campaign.title : `Give to ${org.name}`}
              subtitle={campaign ? `Support ${org.name}` : "Choose an amount and where it goes."}
            />

            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["one_time", "monthly"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
                      frequency === f
                        ? "border-brand-400 bg-brand-50 text-brand-700"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    {f === "one_time" ? "One-time" : "Monthly"}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Amount (CAD)</Label>
              <div className="grid grid-cols-4 gap-2">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setAmount(p);
                      setCustom("");
                    }}
                    className={cn(
                      "rounded-lg border px-2 py-2.5 text-sm font-semibold transition-colors",
                      !custom && amount === p
                        ? "border-brand-400 bg-brand-50 text-brand-700"
                        : "border-border hover:bg-secondary"
                    )}
                  >
                    ${p}
                  </button>
                ))}
              </div>
              <Input
                inputMode="decimal"
                placeholder="Other amount"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
              />
            </div>

            {org.funds.length > 0 && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="fund">Fund</Label>
                <select
                  id="fund"
                  value={fundId}
                  onChange={(e) => setFundId(e.target.value)}
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {org.funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {baseAmount > 0 && (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-border p-3 text-sm">
                <input
                  type="checkbox"
                  checked={coverFees}
                  onChange={(e) => setCoverFees(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
                />
                <span>
                  Add {formatCAD(fee)} to cover processing fees, so {org.name} receives your full gift.
                </span>
              </label>
            )}

            {payError && hosted && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {payError}
              </div>
            )}
            <Button
              size="lg"
              className="w-full"
              disabled={effectiveAmount < 1 || charging}
              onClick={() => (hosted ? payHosted() : setStep(2))}
            >
              {charging && <Loader2 className="size-4 animate-spin" />}
              {hosted ? "Continue to secure payment" : "Continue"} · {formatCAD(effectiveAmount)}
              {frequency === "monthly" ? "/mo" : ""}
            </Button>
          </div>
        )}

        {/* STEP 2 — payment (mock) */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <Header
              icon={<CreditCard className="size-5" />}
              title="Payment"
              subtitle={`${formatCAD(effectiveAmount)}${frequency === "monthly" ? " every month" : ""}`}
            />

            {payError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {payError}
              </div>
            )}

            {/* express wallets — route through the same secure charge */}
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                className="w-full bg-black text-white hover:bg-black/90"
                disabled={charging}
                onClick={pay}
              >
                 Pay
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full"
                disabled={charging}
                onClick={pay}
              >
                G Pay
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or pay by card</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Card number</Label>
                <Input placeholder="4242 4242 4242 4242" defaultValue="4242 4242 4242 4242" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label>Expiry</Label>
                  <Input placeholder="MM / YY" defaultValue="12 / 30" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>CVC</Label>
                  <Input placeholder="123" defaultValue="123" />
                </div>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="size-3.5" /> Demo mode — no real charge. Card is tokenized; we never
              store card numbers.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="lg" onClick={() => setStep(1)} disabled={charging}>
                Back
              </Button>
              <Button size="lg" className="flex-1" onClick={pay} disabled={charging}>
                {charging && <Loader2 className="size-4 animate-spin" />}
                Pay {formatCAD(effectiveAmount, { maximumFractionDigits: 0 })}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3 — details for receipt */}
        {step === 3 && (
          <form action={completeFormAction} className="flex flex-col gap-4">
            <Header
              icon={<CheckCircle2 className="size-5 text-success" />}
              title="Payment received 🎉"
              subtitle={
                org.charityStatus === "registered"
                  ? "Enter your details to receive your official tax receipt."
                  : "Enter your details to receive your payment confirmation."
              }
            />

            {completeState.error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {completeState.error}
              </div>
            )}

            {/* hidden state */}
            <input type="hidden" name="slug" value={org.slug} />
            <input type="hidden" name="chargeRef" value={chargeRef} />
            <input type="hidden" name="amount" value={effectiveAmount} />
            <input type="hidden" name="fundId" value={fundId} />
            <input type="hidden" name="campaignId" value={campaign?.id ?? "none"} />
            <input type="hidden" name="frequency" value={frequency} />

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" name="firstName" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" name="lastName" required />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="addressLine1">Address</Label>
              <Input id="addressLine1" name="addressLine1" placeholder="Street address" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="province">Province</Label>
                <select
                  id="province"
                  name="province"
                  defaultValue="ON"
                  className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" placeholder="A1A 1A1" required />
            </div>

            <SubmitButton size="lg" className="mt-1 w-full">
              Get my receipt
            </SubmitButton>
          </form>
        )}
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Powered by KindPath · Secure donations for faith communities
      </p>
    </div>
  );
}

function Header({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">
        {icon}
      </span>
      <h1 className="mt-2 font-display text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
