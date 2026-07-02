"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus, AlertCircle } from "lucide-react";
import { addTicketType, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};

export function AddTicketTypeForm({ eventId }: { eventId: string }) {
  const [state, action] = useFormState(addTicketType, initial);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form ref={ref} action={action} className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <input type="hidden" name="eventId" value={eventId} />
      <div className="flex flex-1 flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Ticket name</label>
        <Input name="name" placeholder="VIP table" required />
      </div>
      <div className="flex w-28 flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Price</label>
        <Input name="price" inputMode="decimal" placeholder="500" required />
      </div>
      <div className="flex w-28 flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Advantage</label>
        <Input name="advantage" inputMode="decimal" placeholder="100" />
      </div>
      <SubmitButton size="sm">
        <Plus className="size-4" /> Add
      </SubmitButton>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </form>
  );
}
