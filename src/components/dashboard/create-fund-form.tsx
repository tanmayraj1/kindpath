"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus } from "lucide-react";
import { createFund, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};

export function CreateFundForm() {
  const [state, action] = useFormState(createFund, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state.ok]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input name="name" placeholder="Fund name (e.g. Zakat, Building Fund)" required />
        {state.error && <p className="mt-1 text-xs text-destructive">{state.error}</p>}
      </div>
      <Input name="code" placeholder="Code (optional)" className="sm:w-40" />
      <SubmitButton>
        <Plus className="size-4" /> Add fund
      </SubmitButton>
    </form>
  );
}
