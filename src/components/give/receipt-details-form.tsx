"use client";

import { useFormState } from "react-dom";
import { submitReceiptDetails, type DetailsState } from "@/app/give/[slug]/actions";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { PROVINCES } from "@/lib/tax";

const initial: DetailsState = {};

const selectCls =
  "flex h-11 w-full rounded-input border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * The form behind the emailed "finish your receipt" link.
 *
 * Only the fields the receipt actually needs. Nothing about money is on this form
 * — the amount, fund and organization are re-read server-side from the donation
 * the token names, so a donor can complete their details without any of the
 * payment being re-stated or re-submitted.
 */
export function ReceiptDetailsForm(props: {
  donationId: string;
  token: string;
  orgName: string;
  amountLabel: string;
  email: string;
}) {
  const [state, action] = useFormState(submitReceiptDetails, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormAlert>{state.error}</FormAlert>

      <input type="hidden" name="donationId" value={props.donationId} />
      <input type="hidden" name="token" value={props.token} />

      <div className="grid grid-cols-2 gap-3">
        <Field
          name="firstName"
          label="First name"
          autoComplete="given-name"
          required
          errors={state.fields}
        />
        <Field
          name="lastName"
          label="Last name"
          autoComplete="family-name"
          required
          errors={state.fields}
        />
      </div>

      <Field
        name="addressLine1"
        label="Street address"
        placeholder="123 Main Street"
        autoComplete="street-address"
        required
        errors={state.fields}
        hint="The CRA requires your address on an official donation receipt."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field
          name="city"
          label="City"
          autoComplete="address-level2"
          required
          errors={state.fields}
        />
        <div className="flex flex-col gap-2">
          <Label htmlFor="province">Province</Label>
          <select
            id="province"
            name="province"
            required
            autoComplete="address-level1"
            defaultValue=""
            aria-invalid={state.fields?.province ? true : undefined}
            className={selectCls}
          >
            <option value="" disabled>
              Choose…
            </option>
            {PROVINCES.map((p) => (
              <option key={p.code} value={p.code}>
                {p.code}
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
          autoComplete="postal-code"
          required
          errors={state.fields}
        />
      </div>

      <Field
        name="phone"
        label="Phone (optional)"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        errors={state.fields}
        hint="Only so the organization can reach you — not printed on the receipt."
      />

      <SubmitButton className="w-full">Get my receipt</SubmitButton>

      <p className="text-center text-xs text-muted-foreground">
        Your receipt will be emailed to {props.email}.
      </p>
    </form>
  );
}
