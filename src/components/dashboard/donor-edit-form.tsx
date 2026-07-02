"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, Pencil } from "lucide-react";
import { updateDonorDetails, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

type Donor = {
  id: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  emailMarketingOptIn: boolean;
  smsMarketingOptIn: boolean;
};

export function DonorEditForm({ donor }: { donor: Donor }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState(updateDonorDetails, initial);

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Edit donor
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="donorId" value={donor.id} />
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Donor updated.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="firstName">First name</Label>
          <Input id="firstName" name="firstName" defaultValue={donor.firstName} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="lastName">Last name</Label>
          <Input id="lastName" name="lastName" defaultValue={donor.lastName} required />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={donor.phone ?? ""} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={donor.addressLine1 ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={donor.city ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="province">Province</Label>
          <select id="province" name="province" defaultValue={donor.province ?? "ON"} className={selectCls}>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={donor.postalCode ?? ""} />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">Internal notes (not shown to donor)</Label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={donor.notes ?? ""}
          className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
      </div>
      <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
        <p className="text-xs font-medium">Communication consent (CASL)</p>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="emailMarketing" defaultChecked={donor.emailMarketingOptIn} className="size-4 rounded border-input text-primary" />
          Email updates
        </label>
        <label className="flex items-center gap-2.5 text-sm">
          <input type="checkbox" name="smsMarketing" defaultChecked={donor.smsMarketingOptIn} className="size-4 rounded border-input text-primary" />
          SMS updates
        </label>
      </div>

      <div className="flex gap-2">
        <SubmitButton>Save changes</SubmitButton>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
