"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { CheckCircle2, Mail } from "lucide-react";
import {
  completeDonationEmailOnly,
  type EmailOnlyState,
} from "@/app/give/[slug]/actions";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { HostedDetailsForm } from "@/components/give/hosted-details-form";

const initial: EmailOnlyState = {};

/**
 * What a donor sees the moment their card is approved.
 *
 * One field. An official CRA receipt needs a full name and mailing address, but
 * asking for those at a POS terminal or on a phone in a pew is how a queue forms
 * and how people abandon halfway — leaving a charge with no receipt and a donor
 * who thinks something went wrong. So the address is collected later, from the
 * donor's own inbox, and the only thing standing between them and leaving is an
 * email address.
 *
 * The donor who *would* rather finish now can: "Add my details now" swaps in the
 * full form, which posts the original completeDonation action and issues the
 * receipt on the spot. No email round trip for someone sitting at a laptop.
 */
export function HostedEmailForm(props: {
  slug: string;
  orgName: string;
  chargeRef: string;
  amount: number;
  amountLabel: string;
  fundId: string;
  campaignId: string;
  frequency: "one_time" | "monthly";
  card?: string | null;
  /** Registered charities issue official receipts, which need the address. */
  registered: boolean;
}) {
  const [state, action] = useFormState(completeDonationEmailOnly, initial);
  const [detailsNow, setDetailsNow] = useState(false);

  if (detailsNow) {
    return (
      <div className="flex flex-col gap-3">
        <HostedDetailsForm
          slug={props.slug}
          orgName={props.orgName}
          chargeRef={props.chargeRef}
          amount={props.amount}
          amountLabel={props.amountLabel}
          fundId={props.fundId}
          campaignId={props.campaignId}
          frequency={props.frequency}
          card={props.card}
        />
        <button
          type="button"
          onClick={() => setDetailsNow(false)}
          className="text-center text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Email it to me instead
        </button>
      </div>
    );
  }

  // Sent. The gift is recorded either way — what differs is whether anything is
  // still owed by the donor, and the two are never blurred together.
  if (state.ok) {
    const needsDetails = state.status === "details_needed";
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success/10">
          <CheckCircle2 className="size-6 text-success" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-bold">Thank you! 🎉</h1>
        {needsDetails ? (
          <>
            <p className="text-sm text-muted-foreground">
              Your gift of {props.amountLabel} to {props.orgName} is recorded. We&apos;ve emailed
              you a link — open it whenever you like to add your name and address, and your
              official tax receipt will be issued straight away.
            </p>
            <p className="text-xs text-muted-foreground">
              The Canada Revenue Agency requires those details on an official receipt. The link
              works for 90 days.
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your gift of {props.amountLabel} to {props.orgName} is recorded, and your receipt is
            on its way to your inbox.
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-1 text-center">
        <span className="grid size-10 place-items-center rounded-full bg-success/10">
          <CheckCircle2 className="size-5 text-success" aria-hidden />
        </span>
        <h1 className="font-display text-xl font-bold">Payment received 🎉</h1>
        <p className="text-sm text-muted-foreground">
          {props.amountLabel} to {props.orgName}
          {props.card ? ` · ${props.card}` : ""}.
        </p>
      </div>

      <FormAlert>{state.error}</FormAlert>

      <input type="hidden" name="slug" value={props.slug} />
      <input type="hidden" name="chargeRef" value={props.chargeRef} />
      <input type="hidden" name="fundId" value={props.fundId} />
      <input type="hidden" name="campaignId" value={props.campaignId} />
      <input type="hidden" name="frequency" value={props.frequency} />

      <Field
        name="email"
        label="Your email"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        autoFocus
        errors={state.fields}
        hint={
          props.registered
            ? "We'll send your receipt here — you can add the rest later."
            : "We'll send your confirmation here."
        }
      />

      <SubmitButton className="w-full">
        <Mail className="size-4" aria-hidden />
        {props.registered ? "Email me my receipt" : "Email me my confirmation"}
      </SubmitButton>

      {props.registered && (
        <button
          type="button"
          onClick={() => setDetailsNow(true)}
          className="text-center text-sm font-medium text-brand-600 hover:underline"
        >
          Add my details now instead
        </button>
      )}
    </form>
  );
}
