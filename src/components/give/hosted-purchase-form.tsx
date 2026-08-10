"use client";

import { useFormState } from "react-dom";
import { CheckCircle2 } from "lucide-react";
import { completeTicketPurchase, type TicketState } from "@/app/e/[slug]/[event]/actions";
import { completeMembership, type MembershipState } from "@/app/join/[slug]/actions";
import { Label } from "@/components/ui/label";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";

const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

/**
 * Details step after a HOSTED gateway payment for a ticket purchase or a
 * membership join. Mirrors HostedDetailsForm for donations.
 *
 * These two flows previously had no hosted path at all, so with a real gateway
 * configured they ran the demo code path and could never take money.
 */
function Fields({
  fields,
  what,
}: {
  fields?: Record<string, string>;
  what: string;
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Field name="firstName" label="First name" errors={fields} autoComplete="given-name" required />
        <Field name="lastName" label="Last name" errors={fields} autoComplete="family-name" required />
      </div>
      <Field name="email" label="Email" type="email" errors={fields} autoComplete="email" required />
      <Field
        name="addressLine1"
        label="Address"
        placeholder="Street address"
        errors={fields}
        autoComplete="address-line1"
        hint={`Required by the CRA on the receipt for your ${what}.`}
        required
      />
      <div className="grid grid-cols-2 gap-3">
        <Field name="city" label="City" errors={fields} autoComplete="address-level2" required />
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
      </div>
      <Field
        name="postalCode"
        label="Postal code"
        placeholder="A1A 1A1"
        errors={fields}
        autoComplete="postal-code"
        required
      />
    </>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center gap-1 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-success/10">
        <CheckCircle2 className="size-5 text-success" aria-hidden />
      </span>
      <h1 className="font-display text-xl font-bold">Payment received 🎉</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
      <span className="sr-only">{title}</span>
    </div>
  );
}

export function HostedTicketForm(props: {
  slug: string;
  orgName: string;
  chargeRef: string;
  amountLabel: string;
  eventId: string;
  ticketTypeId: string;
  quantity: number;
  card?: string | null;
}) {
  const [state, action] = useFormState(completeTicketPurchase, {} as TicketState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Header
        title="Ticket purchase"
        subtitle={`${props.amountLabel} to ${props.orgName}${props.card ? ` · ${props.card}` : ""}. Enter your details to receive your receipt.`}
      />
      <FormAlert>{state.error}</FormAlert>

      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="chargeRef" value={props.chargeRef} />
      <input type="hidden" name="eventId" value={props.eventId} />
      <input type="hidden" name="ticketTypeId" value={props.ticketTypeId} />
      <input type="hidden" name="quantity" value={props.quantity} />

      <Fields fields={state.fields} what="tickets" />
      <SubmitButton size="lg" className="mt-1 w-full">
        Get my receipt
      </SubmitButton>
    </form>
  );
}

export function HostedMembershipForm(props: {
  slug: string;
  orgName: string;
  chargeRef: string;
  amountLabel: string;
  planId: string;
  card?: string | null;
}) {
  const [state, action] = useFormState(completeMembership, {} as MembershipState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <Header
        title="Membership"
        subtitle={`${props.amountLabel} to ${props.orgName}${props.card ? ` · ${props.card}` : ""}. Enter your details to complete your membership.`}
      />
      <FormAlert>{state.error}</FormAlert>

      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="chargeRef" value={props.chargeRef} />
      <input type="hidden" name="planId" value={props.planId} />

      <Fields fields={state.fields} what="membership" />
      <SubmitButton size="lg" className="mt-1 w-full">
        Complete membership
      </SubmitButton>
    </form>
  );
}
