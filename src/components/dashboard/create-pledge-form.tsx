"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus, AlertCircle } from "lucide-react";
import { createPledge, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function CreatePledgeForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const [state, action] = useFormState(createPledge, initial);
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
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="donorName">Donor name</Label>
          <Input id="donorName" name="donorName" placeholder="Aanya Sharma" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="donorEmail">Email (optional)</Label>
          <Input id="donorEmail" name="donorEmail" type="email" placeholder="aanya@example.com" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="amount">Pledge amount (CAD)</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="5000" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="dueDate">Expected by (optional)</Label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="campaignId">Campaign (optional)</Label>
          <select id="campaignId" name="campaignId" defaultValue="none" className={selectCls}>
            <option value="none">No campaign</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="note">Note (optional)</Label>
          <Input id="note" name="note" placeholder="Pledged at the gala" />
        </div>
      </div>
      <div>
        <SubmitButton>
          <Plus className="size-4" /> Record pledge
        </SubmitButton>
      </div>
    </form>
  );
}
