"use client";

import { useFormState } from "react-dom";
import { updateDonorProfile, type PortalState } from "@/app/portal/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: PortalState = {};
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

type Props = {
  firstName?: string | null;
  lastName?: string | null;
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
      <FormAlert>{state.error}</FormAlert>
      {state.ok && <FormAlert variant="success">Profile updated.</FormAlert>}

      {/* Editable: this is the name printed on an official tax receipt, and a
          donor previously had no way to correct a misspelling of their own. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          name="firstName"
          label="First name"
          defaultValue={props.firstName ?? ""}
          errors={state.fields}
          autoComplete="given-name"
          required
        />
        <Field
          name="lastName"
          label="Last name"
          defaultValue={props.lastName ?? ""}
          errors={state.fields}
          autoComplete="family-name"
          required
        />
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">
        Receipts already issued keep the name they were issued with — that snapshot is what the CRA
        requires. Ask the organization to reissue one if a correction matters.
      </p>

      <Field
        name="phone"
        label="Phone"
        defaultValue={props.phone ?? ""}
        placeholder="(optional)"
        errors={state.fields}
        autoComplete="tel"
      />
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
