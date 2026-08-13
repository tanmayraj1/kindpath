"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus } from "lucide-react";
import { addTicketType, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};

/**
 * The labels here were bare <label> elements with no htmlFor, so they read as
 * decoration rather than naming their input. Field ties label, input and error
 * together with the attributes assistive technology actually uses.
 */
export function AddTicketTypeForm({ eventId }: { eventId: string }) {
  const [state, action] = useFormState(addTicketType, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <input type="hidden" name="eventId" value={eventId} />
      <Field
        name="name"
        label="Ticket name"
        placeholder="VIP table"
        required
        className="flex-1"
        errors={state.fields}
      />
      <Field
        name="price"
        label="Price"
        inputMode="decimal"
        placeholder="500"
        required
        className="sm:w-28"
        errors={state.fields}
      />
      <Field
        name="advantage"
        label="Advantage"
        inputMode="decimal"
        placeholder="100"
        hint="Value received"
        className="sm:w-28"
        errors={state.fields}
      />
      <SubmitButton size="sm" className="sm:mt-8">
        <Plus className="size-4" aria-hidden /> Add
      </SubmitButton>
      {state.error && !state.fields && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
