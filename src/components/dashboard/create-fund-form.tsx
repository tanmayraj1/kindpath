"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus } from "lucide-react";
import { createFund, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};

/**
 * Both inputs previously had a placeholder and no label at all. A placeholder is
 * not a label: it disappears the moment you type, and a screen reader announces
 * the field as unnamed.
 */
export function CreateFundForm() {
  const [state, action] = useFormState(createFund, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <Field
        name="name"
        label="Fund name"
        placeholder="e.g. Zakat, Building Fund"
        required
        className="flex-1"
        errors={state.fields}
      />
      <Field
        name="code"
        label="Code"
        placeholder="Optional"
        className="sm:w-40"
        errors={state.fields}
      />
      <SubmitButton className="sm:mt-8">
        <Plus className="size-4" aria-hidden /> Add fund
      </SubmitButton>
      {state.error && !state.fields && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
