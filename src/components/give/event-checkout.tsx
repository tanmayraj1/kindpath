"use client";

import { startPayment } from "@/lib/payment-action";
import { useState } from "react";
import { useFormState } from "react-dom";
import { Ticket, CreditCard, Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { authorizeCharge, beginHostedTicketPurchase } from "@/app/give/[slug]/actions";
import { completeTicketPurchase, type TicketState } from "@/app/e/[slug]/[event]/actions";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { DemoPaymentNotice } from "./demo-payment-notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { cn, formatCAD } from "@/lib/utils";

type Org = { slug: string };
type TicketTypeT = { id: string; name: string; price: number; advantage: number };
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const initial: TicketState = {};

export function EventCheckout({
  hosted = false, org, eventId, ticketTypes }: { org: Org; eventId: string; ticketTypes: TicketTypeT[]; hosted?: boolean }) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [ttId, setTtId] = useState(ticketTypes[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [chargeRef, setChargeRef] = useState("");
  const [charging, setCharging] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [state, formAction] = useFormState(completeTicketPurchase, initial);

  const tt = ticketTypes.find((t) => t.id === ttId);
  const total = tt ? tt.price * qty : 0;
  const eligible = tt ? Math.max(0, (tt.price - tt.advantage) * qty) : 0;

  /** Redirect gateways (Stripe Checkout, WeVend) take payment on their own page. */
  async function payHosted() {
    if (!tt) return;
    setPayError(null);
    setCharging(true);
    const res = await startPayment(() =>
      beginHostedTicketPurchase({
        slug: org.slug,
        amount: total,
        eventId,
        ticketTypeId: ttId,
        quantity: qty,
        description: `${qty}× ${tt.name}`,
      })
    );
    if (res.ok) {
      window.location.assign(res.redirectTo);
    } else {
      setCharging(false);
      setPayError(res.message);
    }
  }

  async function pay() {
    if (!tt) return;
    setPayError(null);
    setCharging(true);
    const res = await authorizeCharge(org.slug, total);
    setCharging(false);
    if (res.ok) { setChargeRef(res.chargeRef); setStep(3); }
    else setPayError(res.message);
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3].map((n) => <span key={n} className={cn("h-1.5 w-10 rounded-full", step >= n ? "bg-primary" : "bg-border")} />)}
      </div>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-lg sm:p-8">
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <Header icon={<Ticket className="size-5" />} title="Get tickets" subtitle="Choose a ticket type and quantity." />
            <div className="flex flex-col gap-3">
              {ticketTypes.map((t) => (
                <button key={t.id} type="button" onClick={() => setTtId(t.id)}
                  className={cn("flex items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors", ttId === t.id ? "border-brand-400 bg-brand-50" : "border-border hover:bg-secondary")}>
                  <span>
                    <span className="font-semibold">{t.name}</span>
                    {t.advantage > 0 && <span className="mt-0.5 block text-xs text-muted-foreground">{formatCAD(t.price - t.advantage)} tax-receiptable</span>}
                  </span>
                  <span className="font-display font-bold">{formatCAD(t.price, { maximumFractionDigits: 0 })}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="qty">Quantity</Label>
              <input id="qty" type="number" min={1} max={20} value={qty}
                onChange={(e) => setQty(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                className="h-10 w-20 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30" />
            </div>
            <Button size="lg" className="w-full" disabled={!tt} onClick={() => (hosted ? payHosted() : setStep(2))}>
              Continue · {formatCAD(total, { maximumFractionDigits: 0 })}
            </Button>
          </div>
        )}

        {step === 2 && tt && (
          <div className="flex flex-col gap-5">
            <Header icon={<CreditCard className="size-5" />} title="Demo payment" subtitle={`${qty}× ${tt.name} · ${formatCAD(total)}`} />
            {tt.advantage > 0 && (
              <p className="rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                {formatCAD(eligible)} of this is an eligible gift for tax purposes; {formatCAD(total - eligible)} is the value of admission.
              </p>
            )}
            {payError && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" /> {payError}</div>}
            <DemoPaymentNotice />
            <div className="flex gap-2">
              <Button variant="outline" size="lg" disabled={charging} onClick={() => setStep(1)}>Back</Button>
              <Button size="lg" className="flex-1" disabled={charging} onClick={pay}>
                {charging && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Simulate approved payment · {formatCAD(total, { maximumFractionDigits: 0 })}
              </Button>
            </div>
          </div>
        )}

        {step === 3 && tt && (
          <form action={formAction} className="flex flex-col gap-4">
            <Header icon={<CheckCircle2 className="size-5 text-success" />} title="Payment received 🎉" subtitle="Enter your details to get your receipt." />
            {state.error && <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"><AlertCircle className="size-4 shrink-0" /> {state.error}</div>}
            <input type="hidden" name="slug" value={org.slug} />
            <input type="hidden" name="chargeRef" value={chargeRef} />
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="ticketTypeId" value={ttId} />
            <input type="hidden" name="quantity" value={qty} />
            <div className="grid grid-cols-2 gap-3">
              <Field name="firstName" label="First name" required errors={state.fields} />
              <Field name="lastName" label="Last name" required errors={state.fields} />
            </div>
            <Field name="email" label="Email" type="email" required errors={state.fields} />
            <Field
              name="addressLine1"
              label="Address"
              required
              hint="Required by the CRA on an official donation receipt."
              errors={state.fields}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field name="city" label="City" required errors={state.fields} />
              <div className="flex flex-col gap-2">
                <Label htmlFor="province">Province</Label>
                <select id="province" name="province" defaultValue="ON" className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30">
                  {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <Field name="postalCode" label="Postal code" placeholder="A1A 1A1" required errors={state.fields} />
            <SubmitButton size="lg" className="w-full">Get my receipt</SubmitButton>
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
