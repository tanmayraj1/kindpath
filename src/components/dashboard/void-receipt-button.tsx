"use client";

import { useTransition } from "react";
import { Ban, Loader2 } from "lucide-react";
import { voidReceipt } from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";

export function VoidReceiptButton({ receiptId }: { receiptId: string }) {
  const [pending, start] = useTransition();

  function onVoid() {
    const reason = window.prompt(
      "Reason for voiding this receipt? (e.g. refund, correction)"
    );
    if (reason === null) return; // cancelled
    start(() => voidReceipt(receiptId, reason));
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      className="text-destructive hover:bg-destructive/10"
      onClick={onVoid}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
      Void
    </Button>
  );
}
