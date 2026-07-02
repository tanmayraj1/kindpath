"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus, AlertCircle } from "lucide-react";
import { createCampaign, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};
const selectCls =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

export function CreateCampaignForm({ funds }: { funds: { id: string; name: string }[] }) {
  const [state, action] = useFormState(createCampaign, initial);
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
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="title">Campaign title</Label>
          <Input id="title" name="title" placeholder="Ramadan Building Fund 2026" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="goalAmount">Goal (CAD)</Label>
          <Input id="goalAmount" name="goalAmount" inputMode="decimal" placeholder="50000" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="deadline">Deadline (optional)</Label>
          <Input id="deadline" name="deadline" type="date" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="fundId">Fund (optional)</Label>
          <select id="fundId" name="fundId" defaultValue="none" className={selectCls}>
            <option value="none">No specific fund</option>
            {funds.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="accent">Icon (emoji)</Label>
          <Input id="accent" name="accent" placeholder="🎯" maxLength={8} />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Input id="description" name="description" placeholder="Help us reach our goal…" />
        </div>
      </div>
      <div>
        <SubmitButton>
          <Plus className="size-4" /> Create campaign
        </SubmitButton>
      </div>
    </form>
  );
}
