"use client";

import { useState, useTransition } from "react";
import { Pause, Play, X, Loader2, RefreshCw } from "lucide-react";
import { updatePlanStatus, retryFailedPlan } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";
import { ActionButton } from "@/components/ui/action-button";

export function PlanControls({
  planId,
  status,
  retryable = false,
}: {
  planId: string;
  status: string;
  /** true when the plan is past-due or suspended and can be retried by the donor */
  retryable?: boolean;
}) {
  const [pending, start] = useTransition();
  const [retryMsg, setRetryMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (status === "cancelled") {
    return <span className="text-sm text-muted-foreground">Cancelled</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-start justify-end gap-2">
        {retryable && (
          <Button
            variant="primary"
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await retryFailedPlan(planId);
                setRetryMsg({ ok: !!r.ok, text: r.message ?? r.error ?? "" });
              })
            }
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Retry payment
          </Button>
        )}
        {status === "active" ? (
          <ActionButton variant="outline" size="sm" action={() => updatePlanStatus(planId, "pause")}>
            <Pause className="size-4" aria-hidden /> Pause
          </ActionButton>
        ) : status === "paused" ? (
          <ActionButton variant="outline" size="sm" action={() => updatePlanStatus(planId, "resume")}>
            <Play className="size-4" aria-hidden /> Resume
          </ActionButton>
        ) : null}

        {/* Cancelling a recurring gift had no confirmation step at all — one
            mis-click ended the gift, and the action reported nothing back. */}
        <ActionButton
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          action={() => updatePlanStatus(planId, "cancel")}
          confirm={{
            title: "Cancel this recurring gift?",
            description:
              "We'll stop collecting it. Gifts you've already made are unaffected and you keep every receipt. You can always start a new recurring gift later.",
            confirmLabel: "Cancel my gift",
            destructive: true,
          }}
        >
          <X className="size-4" aria-hidden /> Cancel
        </ActionButton>
      </div>
      {retryMsg && (
        <p className={retryMsg.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {retryMsg.text}
        </p>
      )}
    </div>
  );
}
