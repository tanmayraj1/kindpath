"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { updateDonorProfile, type PortalState } from "@/app/portal/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: PortalState = {};
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

type Props = {
  phone?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  province?: string | null;
  postalCode?: string | null;
  emailMarketing: boolean;
  smsMarketing: boolean;
};

export function ProfileForm(props: Props) {
  const [state, action] = useFormState(updateDonorProfile, initial);

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Profile updated.
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={props.phone ?? ""} placeholder="(optional)" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="addressLine1">Address</Label>
        <Input id="addressLine1" name="addressLine1" defaultValue={props.addressLine1 ?? ""} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2 sm:col-span-1">
          <Label htmlFor="city">City</Label>
          <Input id="city" name="city" defaultValue={props.city ?? ""} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="province">Province</Label>
          <select
            id="province"
            name="province"
            defaultValue={props.province ?? "ON"}
            className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          >
            {PROVINCES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="postalCode">Postal code</Label>
          <Input id="postalCode" name="postalCode" defaultValue={props.postalCode ?? ""} />
        </div>
      </div>

      <div className="rounded-xl border border-border p-4">
        <p className="text-sm font-medium">Communication preferences (CASL)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Choose how your organization may contact you. You can opt out anytime.
        </p>
        <div className="mt-3 flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="emailMarketing"
              defaultChecked={props.emailMarketing}
              className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            Email me announcements and updates
          </label>
          <label className="flex items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              name="smsMarketing"
              defaultChecked={props.smsMarketing}
              className="size-4 rounded border-input text-primary focus-visible:ring-2 focus-visible:ring-ring/30"
            />
            Text me announcements and updates
          </label>
        </div>
      </div>

      <div>
        <SubmitButton>Save changes</SubmitButton>
      </div>
    </form>
  );
}
