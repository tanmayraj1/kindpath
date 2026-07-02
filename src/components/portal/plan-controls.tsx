"use client";

import { useState, useTransition } from "react";
import { Pause, Play, X, Loader2, RefreshCw } from "lucide-react";
import { updatePlanStatus, retryFailedPlan } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";

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
      <div className="flex justify-end gap-2">
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
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => start(() => updatePlanStatus(planId, "pause"))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
            Pause
          </Button>
        ) : status === "paused" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => start(() => updatePlanStatus(planId, "resume"))}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            Resume
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={pending}
          className="text-destructive hover:bg-destructive/10"
          onClick={() => start(() => updatePlanStatus(planId, "cancel"))}
        >
          <X className="size-4" />
          Cancel
        </Button>
      </div>
      {retryMsg && (
        <p className={retryMsg.ok ? "text-xs text-success" : "text-xs text-destructive"}>
          {retryMsg.text}
        </p>
      )}
    </div>
  );
}
