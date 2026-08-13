"use client";

import { Trash2 } from "lucide-react";
import { removePaymentMethod } from "@/app/portal/actions";
import { ActionButton } from "@/components/ui/action-button";

export function RemoveMethodButton({ methodId }: { methodId: string }) {
  return (
    <ActionButton
      variant="ghost"
      size="sm"
      className="text-destructive hover:bg-destructive/10"
      action={() => removePaymentMethod(methodId)}
      confirm={{
        title: "Remove this card?",
        description:
          "We'll stop keeping it on file. If a recurring gift is being paid with it, add another card first — we'll tell you rather than let the gift lapse.",
        confirmLabel: "Remove card",
        destructive: true,
      }}
    >
      <Trash2 className="size-4" aria-hidden /> Remove
    </ActionButton>
  );
}
