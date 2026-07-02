"use client";

import { useEffect, useRef } from "react";
import { useFormState } from "react-dom";
import { Plus, AlertCircle } from "lucide-react";
import { createEvent, type ActionState } from "@/app/(dashboard)/dashboard/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ActionState = {};

export function CreateEventForm() {
  const [state, action] = useFormState(createEvent, initial);
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
          <Label htmlFor="title">Event title</Label>
          <Input id="title" name="title" placeholder="Annual Fundraising Gala 2026" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="startsAt">Date &amp; time</Label>
          <Input id="startsAt" name="startsAt" type="datetime-local" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="Parish Hall" />
        </div>
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Input id="description" name="description" placeholder="An evening of dinner and giving." />
        </div>
      </div>
      <div className="rounded-lg border border-border p-3">
        <p className="text-sm font-medium">First ticket type</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          The “advantage” is the value the attendee receives (e.g. dinner); only the rest is tax-receiptable.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticketName">Ticket name</Label>
            <Input id="ticketName" name="ticketName" placeholder="Gala seat" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticketPrice">Price (CAD)</Label>
            <Input id="ticketPrice" name="ticketPrice" inputMode="decimal" placeholder="200" required />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticketAdvantage">Advantage value</Label>
            <Input id="ticketAdvantage" name="ticketAdvantage" inputMode="decimal" placeholder="50" />
          </div>
        </div>
      </div>
      <div>
        <SubmitButton>
          <Plus className="size-4" /> Create event
        </SubmitButton>
      </div>
    </form>
  );
}
