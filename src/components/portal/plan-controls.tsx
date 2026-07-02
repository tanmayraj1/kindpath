"use client";

import { useTransition } from "react";
import { Pause, Play, X, Loader2 } from "lucide-react";
import { updatePlanStatus } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";

export function PlanControls({
  planId,
  status,
}: {
  planId: string;
  status: string;
}) {
  const [pending, start] = useTransition();

  if (status === "cancelled") {
    return <span className="text-sm text-muted-foreground">Cancelled</span>;
  }

  return (
    <div className="flex justify-end gap-2">
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
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => start(() => updatePlanStatus(planId, "resume"))}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Resume
        </Button>
      )}
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
  );
}
