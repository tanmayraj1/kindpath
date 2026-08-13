"use client";

import { Eye, EyeOff } from "lucide-react";
import { setEventStatus } from "@/app/(dashboard)/dashboard/actions";
import { ActionButton } from "@/components/ui/action-button";

export function EventStatusButton({ id, status }: { id: string; status: string }) {
  const published = status === "published";
  return (
    <ActionButton
      variant="outline"
      size="sm"
      action={() => setEventStatus(id, published ? "closed" : "published")}
      confirm={
        published
          ? {
              title: "Close this event?",
              description:
                "Its public page stops selling tickets. Tickets already sold stay valid and their receipts are untouched. You can publish it again later.",
              confirmLabel: "Close event",
            }
          : undefined
      }
    >
      {published ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      {published ? "Close event" : "Publish"}
    </ActionButton>
  );
}
