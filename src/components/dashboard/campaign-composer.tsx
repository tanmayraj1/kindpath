"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { AlertCircle, CheckCircle2, Send } from "lucide-react";
import { sendCampaign, type CampaignState } from "@/app/(dashboard)/dashboard/actions";
import { SEGMENTS, type SegmentKey } from "@/lib/segments";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/auth/submit-button";

const initial: CampaignState = {};

export function CampaignComposer({ counts }: { counts: Record<string, number> }) {
  const [state, action] = useFormState(sendCampaign, initial);
  const [segment, setSegment] = useState<SegmentKey>("all");
  const recipientCount = counts[segment] ?? 0;

  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" /> {state.error}
        </div>
      )}
      {state.ok && (
        <div className="flex items-center gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" />
          Sent to {state.sent} donor{state.sent === 1 ? "" : "s"}.
          {state.capped ? " (Capped at 200 — run again or contact us for larger sends.)" : ""}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor="segment">Audience</Label>
        <select
          id="segment"
          name="segment"
          value={segment}
          onChange={(e) => setSegment(e.target.value as SegmentKey)}
          className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        >
          {SEGMENTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label} ({counts[s.key] ?? 0})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          {SEGMENTS.find((s) => s.key === segment)?.description} · <strong>{recipientCount}</strong>{" "}
          consented recipient{recipientCount === 1 ? "" : "s"} will receive this.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="subject">Subject</Label>
        <Input id="subject" name="subject" placeholder="An update from our community" required />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="message">Message</Label>
        <textarea
          id="message"
          name="message"
          rows={7}
          placeholder="Write your announcement… (sent with your branding, CASL footer + unsubscribe added automatically)"
          className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          required
        />
      </div>

      <div>
        <SubmitButton disabled={recipientCount === 0}>
          <Send className="size-4" /> Send to {recipientCount}
        </SubmitButton>
      </div>
    </form>
  );
}
