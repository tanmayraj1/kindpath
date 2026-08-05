"use client";

import { useState, useTransition } from "react";
import { Ban, FileCheck2 } from "lucide-react";
import {
  voidReceipt,
  reissueReceipt,
  type ReceiptActionState,
} from "@/app/(dashboard)/dashboard/actions";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";

/**
 * Void, and then optionally replace, an issued receipt.
 *
 * The reason is captured in a real dialog rather than window.prompt — some
 * browsers and embedded webviews suppress prompt() entirely, which silently
 * cancelled the void with no feedback at all.
 */
export function VoidReceiptButton({
  receiptId,
  status,
}: {
  receiptId: string;
  status: string;
}) {
  const [, start] = useTransition();
  const [result, setResult] = useState<ReceiptActionState | null>(null);

  if (status === "replaced") {
    return <span className="text-xs text-muted-foreground">Replaced</span>;
  }

  if (status === "voided") {
    return (
      <div className="flex flex-col items-end gap-1">
        <ConfirmButton
          variant="outline"
          size="sm"
          title="Issue a replacement receipt?"
          description="A new receipt is created with its own serial number, recording the serial it replaces. The voided receipt is retained, as CRA requires."
          confirmLabel="Issue replacement"
          onConfirm={() => start(async () => setResult(await reissueReceipt(receiptId)))}
        >
          <FileCheck2 className="size-4" aria-hidden /> Reissue
        </ConfirmButton>
        {result?.error && <FormAlert className="max-w-xs text-left">{result.error}</FormAlert>}
        {result?.ok && (
          <FormAlert variant="success" className="max-w-xs text-left">
            Replacement issued as {result.serial}.
          </FormAlert>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmButton
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        title="Void this receipt?"
        description="The receipt is kept on file and marked VOID — including on any PDF downloaded afterwards — so it can't be claimed. You can issue a replacement next."
        confirmLabel="Void receipt"
        destructive
        reasonLabel="Reason"
        reasonPlaceholder="Refund issued, corrected address, …"
        onConfirm={(reason) => start(async () => setResult(await voidReceipt(receiptId, reason)))}
      >
        <Ban className="size-4" aria-hidden /> Void
      </ConfirmButton>
      {result?.error && <FormAlert className="max-w-xs text-left">{result.error}</FormAlert>}
    </div>
  );
}
