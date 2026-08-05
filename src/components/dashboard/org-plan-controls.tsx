"use client";

import { useTransition } from "react";
import { Pause, Play, X, Loader2 } from "lucide-react";
import { orgUpdatePlanStatus } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";

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
      <ConfirmButton
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive hover:bg-destructive/10"
        title="Cancel this recurring gift?"
        description="No further donations will be collected. This can't be undone — the donor would need to set up a new recurring gift."
        confirmLabel="Cancel plan"
        destructive
        onConfirm={() => start(() => orgUpdatePlanStatus(planId, "cancel"))}
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">Cancel plan</span>
      </ConfirmButton>
    </div>
  );
}
