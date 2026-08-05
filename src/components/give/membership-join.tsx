"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Users, CreditCard, Lock, Loader2, AlertCircle, CheckCircle2, Check } from "lucide-react";
import { authorizeCharge } from "@/app/give/[slug]/actions";
import { completeMembership, type MembershipState } from "@/app/join/[slug]/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DemoPaymentNotice } from "./demo-payment-notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn, formatCAD } from "@/lib/utils";

type Org = { name: string; slug: string };
type Plan = { id: string; name: string; description: string | null; amount: number; frequency: string };
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const initial: MembershipState = {};
const per: Record<string, string> = { weekly: "/wk", monthly: "/mo", quarterly: "/qtr", annual: "/yr" };

export function MembershipJoin({ org, plans }: { org: Org; plans: Plan[] }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [chargeRef, setChargeRef] = useState("");
  const [charging, setCharging] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [state, formAction] = useFormState(completeMembership, initial);

  const plan = plans.find((p) => p.id === planId);

  async function pay() {
    if (!plan) return;
    setPayError(null);
    setCharging(true);
    const res = await authorizeCharge(org.slug, plan.amount);
    setCharging(false);
    if (res.ok) {
      setChargeRef(res.chargeRef);
      setStep(3);
    } else setPayError(res.message);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-1.5 w-10 rounded-full", step >= n ? "bg-primary" : "bg-border")} />
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <Header icon={<Users className="size-5" />} title={`Become a member of ${org.name}`} subtitle="Choose a membership." />
            <div className="flex flex-col gap-3">
              {plans.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlanId(p.id)}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition-colors",
                    planId === p.id ? "border-brand-400 bg-brand-50" : "border-border hover:bg-secondary"
                  )}
                >
                  <span>
                    <span className="flex items-center gap-2 font-semibold">
                      {planId === p.id && <Check className="size-4 text-brand-600" />}
                      {p.name}
                    </span>
                    {p.description && <span className="mt-0.5 block text-sm text-muted-foreground">{p.description}</span>}
                  </span>
                  <span className="shrink-0 font-display font-bold">
                    {formatCAD(p.amount, { maximumFractionDigits: 0 })}
                    <span className="text-xs font-normal text-muted-foreground">{per[p.frequency] ?? ""}</span>
                  </span>
                </button>
              ))}
            </div>
            <Button size="lg" className="w-full" disabled={!plan} onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        )}

        {step === 2 && plan && (
          <div className="flex flex-col gap-5">
            <Header
              icon={<CreditCard className="size-5" />}
              title="Demo payment"
              subtitle={`${plan.name} · ${formatCAD(plan.amount)}${per[plan.frequency] ?? ""}`}
            />
            {payError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" /> {payError}
              </div>
            )}
            <DemoPaymentNotice />
            <div className="flex gap-2">
              <Button variant="outline" size="lg" disabled={charging} onClick={() => setStep(1)}>Back</Button>
              <Button size="lg" className="flex-1" disabled={charging} onClick={pay}>
                {charging && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Simulate approved payment · {formatCAD(plan.amount, { maximumFractionDigits: 0 })}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && plan && (
          <form action={formAction} className="flex flex-col gap-4">
            <Header icon={<CheckCircle2 className="size-5 text-success" />} title="Payment received 🎉" subtitle="Enter your details to complete your membership." />
            {state.error && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" /> {state.error}
              </div>
            )}
            <input type="hidden" name="slug" value={org.slug} />
            <input type="hidden" name="chargeRef" value={chargeRef} />
            <input type="hidden" name="planId" value={planId} />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2"><Label htmlFor="firstName">First name</Label><Input id="firstName" name="firstName" required /></div>
              <div className="flex flex-col gap-2"><Label htmlFor="lastName">Last name</Label><Input id="lastName" name="lastName" required /></div>
            </div>
            <div className="flex flex-col gap-2"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required /></div>
            <div className="flex flex-col gap-2"><Label htmlFor="addressLine1">Address</Label><Input id="addressLine1" name="addressLine1" required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2"><Label htmlFor="city">City</Label><Input id="city" name="city" required /></div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="province">Province</Label>
                <select id="province" name="province" defaultValue="ON" className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-col gap-2"><Label htmlFor="postalCode">Postal code</Label><Input id="postalCode" name="postalCode" placeholder="A1A 1A1" required /></div>
            <SubmitButton size="lg" className="w-full">Complete membership</SubmitButton>
          </form>
        )}
      </div>
      <p className="mt-4 text-center text-xs text-muted-foreground">Powered by KindPath</p>
    </div>
  );
}

function Header({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="grid size-11 place-items-center rounded-xl bg-brand-50 text-brand-600">{icon}</span>
      <h1 className="mt-2 font-display text-xl font-bold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}
