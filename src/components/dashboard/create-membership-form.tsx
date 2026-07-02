"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus, AlertCircle } from "lucide-react";
import { createMembershipPlan, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function CreateMembershipForm() {
  const [state, action] = useFormState(createMembershipPlan, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="name">Plan name</Label>
          <Input id="name" name="name" placeholder="Family membership" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Amount (CAD)</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="120" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="frequency">Billing</Label>
          <select id="frequency" name="frequency" defaultValue="annual" className={selectCls}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
            <option value="annual">Annual</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:col-span-4">
          <Label htmlFor="description">Description (optional)</Label>
          <Input id="description" name="description" placeholder="Includes voting rights and newsletter." />
        </div>
      </div>
      <div>
        <SubmitButton>
          <Plus className="size-4" /> Add membership plan
        </SubmitButton>
      </div>
    </form>
  );
}
