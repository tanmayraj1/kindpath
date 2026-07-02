"use client";

import { useTransition } from "react";
import { Check, X, Loader2 } from "lucide-react";
import { setPledgeStatus } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function PledgeActions({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  if (status !== "open") return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex justify-end gap-2">
      <Button variant="outline" size="sm" disabled={pending} onClick={() => start(() => setPledgeStatus(id, "fulfilled"))}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4 text-success" />}
        Fulfilled
      </Button>
      <Button variant="ghost" size="sm" disabled={pending} className="text-destructive hover:bg-destructive/10" onClick={() => start(() => setPledgeStatus(id, "cancelled"))}>
        <X className="size-4" />
      </Button>
    </div>
  );
}
