"use client";

import { useTransition } from "react";
import { Pause, Play, X, Loader2 } from "lucide-react";
import { orgUpdatePlanStatus } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function OrgPlanControls({ planId, status }: { planId: string; status: string }) {
  const [pending, start] = useTransition();

  if (status === "cancelled") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex justify-end gap-1.5">
      {status === "active" ? (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(() => orgUpdatePlanStatus(planId, "pause"))}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Pause className="size-4" />}
          Pause
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => start(() => orgUpdatePlanStatus(planId, "resume"))}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Resume
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive hover:bg-destructive/10"
        onClick={() => {
          if (confirm("Cancel this recurring plan?")) start(() => orgUpdatePlanStatus(planId, "cancel"));
        }}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
