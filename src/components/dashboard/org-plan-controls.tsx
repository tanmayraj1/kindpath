"use client";

import { Pause, Play, X } from "lucide-react";
import { orgUpdatePlanStatus } from "@/app/(dashboard)/dashboard/actions";
import { ActionButton } from "@/components/ui/action-button";

export function OrgPlanControls({ planId, status }: { planId: string; status: string }) {
  if (status === "cancelled") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex justify-end gap-1.5">
      {status === "active" ? (
        <ActionButton variant="outline" size="sm" action={() => orgUpdatePlanStatus(planId, "pause")}>
          <Pause className="size-4" aria-hidden /> Pause
        </ActionButton>
      ) : (
        <ActionButton variant="outline" size="sm" action={() => orgUpdatePlanStatus(planId, "resume")}>
          <Play className="size-4" aria-hidden /> Resume
        </ActionButton>
      )}
      <ActionButton
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        action={() => orgUpdatePlanStatus(planId, "cancel")}
        confirm={{
          title: "Cancel this recurring gift?",
          description:
            "No further donations will be collected. This can't be undone — the donor would need to set up a new recurring gift. Gifts already received keep their receipts.",
          confirmLabel: "Cancel plan",
          destructive: true,
        }}
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">Cancel plan</span>
      </ActionButton>
    </div>
  );
}
