"use client";

import { Lock, Unlock } from "lucide-react";
import { setCampaignStatus } from "@/app/(dashboard)/dashboard/actions";
import { ActionButton } from "@/components/ui/action-button";

export function CampaignStatusButton({ id, status }: { id: string; status: string }) {
  const active = status === "active";
  return (
    <ActionButton
      variant="outline"
      size="sm"
      action={() => setCampaignStatus(id, active ? "closed" : "active")}
      confirm={
        active
          ? {
              title: "Close this campaign?",
              description:
                "Its public page stops accepting new gifts. Donations already received and their receipts are untouched, and you can reopen it at any time.",
              confirmLabel: "Close campaign",
            }
          : undefined
      }
    >
      {active ? <Lock className="size-4" aria-hidden /> : <Unlock className="size-4" aria-hidden />}
      {active ? "Close" : "Reopen"}
    </ActionButton>
  );
}
