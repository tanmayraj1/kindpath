"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { completeDonation, type CompleteState } from "@/app/give/[slug]/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const initial: CompleteState = {};

/**
 * Details step shown after a HOSTED gateway payment is confirmed server-side
 * (WeVend flow). Mirrors the in-flow details form; posts the same
 * completeDonation action with the signed chargeRef.
 */
export function HostedDetailsForm(props: {
  slug: string;
  orgName: string;
  chargeRef: string;
  amount: number;
  amountLabel: string;
  fundId: string;
  campaignId: string;
  frequency: "one_time" | "monthly";
  card?: string | null;
}) {
  const [state, action] = useFormState(completeDonation, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-success/10">
          <CheckCircle2 className="size-5 text-success" />
        </span>
        <h1 className="font-display text-xl font-bold">Payment received 🎉</h1>
        <p className="text-sm text-muted-foreground">
          {props.amountLabel} to {props.orgName}
          {props.card ? ` · ${props.card}` : ""}. Enter your details to receive your receipt.
        </p>
      </div>

      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          {state.error}
        </div>
      )}

      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="chargeRef" value={props.chargeRef} />
      <input type="hidden" name="amount" value={props.amount} />
      <input type="hidden" name="fundId" value={props.fundId} />
      <input type="hidden" name="campaignId" value={props.campaignId} />
      <input type="hidden" name="frequency" value={props.frequency} />

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
  );
}
