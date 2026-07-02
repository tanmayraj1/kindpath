"use client";

import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { submitContact, type ContactState } from "@/app/contact/actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: ContactState = {};

export function ContactForm() {
  const [state, action] = useFormState(submitContact, initial);

  if (state.ok) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-success/20 bg-success/5 p-8 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <CheckCircle2 className="size-6" />
        </span>
        <h3 className="font-display text-lg font-semibold">Thanks — we&apos;ll be in touch!</h3>
        <p className="text-sm text-muted-foreground">
          A member of our team will reach out within one business day to book your demo.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" placeholder="Jane Doe" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="you@organization.org" required />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org">Organization (optional)</Label>
        <Input id="org" name="org" placeholder="St. Mary's Parish" />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="message">How can we help?</Label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="Tell us about your community and what you're looking for…"
          className="flex w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          required
        />
      </div>
      <SubmitButton size="lg">Request a demo</SubmitButton>
    </form>
  );
}
