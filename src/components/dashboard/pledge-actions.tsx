"use client";

import { Check, X } from "lucide-react";
import { setPledgeStatus } from "@/app/(dashboard)/dashboard/actions";
import { ActionButton } from "@/components/ui/action-button";

export function PledgeActions({ id, status }: { id: string; status: string }) {
  if (status !== "open") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex justify-end gap-2">
      <ActionButton variant="outline" size="sm" action={() => setPledgeStatus(id, "fulfilled")}>
        <Check className="size-4 text-success" aria-hidden /> Fulfilled
      </ActionButton>
      <ActionButton
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        action={() => setPledgeStatus(id, "cancelled")}
        confirm={{
          title: "Cancel this pledge?",
          description:
            "It stops counting toward the campaign total. Any gift already received against it keeps its receipt.",
          confirmLabel: "Cancel pledge",
          destructive: true,
        }}
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">Cancel pledge</span>
      </ActionButton>
    </div>
  );
}
