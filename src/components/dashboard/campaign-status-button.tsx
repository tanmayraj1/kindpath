"use client";

import { useTransition } from "react";
import { Loader2, Lock, Unlock } from "lucide-react";
import { setCampaignStatus } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function CampaignStatusButton({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  const active = status === "active";
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => start(() => setCampaignStatus(id, active ? "closed" : "active"))}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" />
      ) : active ? (
        <Lock className="size-4" />
      ) : (
        <Unlock className="size-4" />
      )}
      {active ? "Close" : "Reopen"}
    </Button>
  );
}
