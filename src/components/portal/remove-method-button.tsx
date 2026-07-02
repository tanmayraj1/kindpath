"use client";

import { useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { removePaymentMethod } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";

export function RemoveMethodButton({ methodId }: { methodId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-destructive hover:bg-destructive/10"
      onClick={() => start(() => removePaymentMethod(methodId))}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
      Remove
    </Button>
  );
}
