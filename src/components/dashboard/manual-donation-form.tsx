"use client";

import { useFormState } from "react-dom";
import { AlertCircle } from "lucide-react";
import { logManualDonation, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function ManualDonationForm({ funds }: { funds: { id: string; name: string }[] }) {
  const [state, action] = useFormState(logManualDonation, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
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

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Amount (CAD)</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="100" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type">Method</Label>
          <select id="type" name="type" defaultValue="cash" className={selectCls}>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="one_time">Card / other</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fundId">Fund</Label>
          <select id="fundId" name="fundId" defaultValue={funds[0]?.id ?? "none"} className={selectCls}>
            {funds.length === 0 && <option value="none">General</option>}
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="advantageValue">Advantage value (optional)</Label>
          <Input id="advantageValue" name="advantageValue" inputMode="decimal" placeholder="0" />
          <p className="text-xs text-muted-foreground">
            Value of anything the donor received back (e.g. event ticket). Reduces the eligible amount.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="advantageDescription">Advantage description</Label>
          <Input id="advantageDescription" name="advantageDescription" placeholder="Gala dinner ticket" />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Donor address (required for a tax receipt)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave blank to record the gift without issuing a receipt yet.
        </p>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="addressLine1">Address</Label>
            <Input id="addressLine1" name="addressLine1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="province">Province</Label>
              <select id="province" name="province" defaultValue="ON" className={selectCls}>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="postalCode">Postal code</Label>
              <Input id="postalCode" name="postalCode" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <SubmitButton size="lg">Record donation</SubmitButton>
      </div>
    </form>
  );
}
