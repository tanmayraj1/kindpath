"use client";

import { useState, useTransition } from "react";
import { requestMyErasure, type PortalState } from "@/app/portal/actions";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";

/**
 * Right-to-erasure request.
 *
 * The confirmation text states plainly what will and won't be removed. A donor
 * agreeing to "delete everything" and then discovering their receipts were kept
 * would be a worse outcome than telling them the truth first — and the retention
 * isn't optional, it's what the Income Tax Act requires of the charity.
 */
export function ErasureRequest({ receiptCount }: { receiptCount: number }) {
  const [, start] = useTransition();
  const [result, setResult] = useState<(PortalState & { receiptsRetained?: number }) | null>(null);

  if (result?.ok) {
    return (
      <FormAlert variant="success">
        Your personal details have been removed. {result.receiptsRetained ?? 0} tax receipt
        {result.receiptsRetained === 1 ? "" : "s"} remain on file as the Income Tax Act requires —
        they still show the name and address they were issued with. You&apos;ve been signed out.
      </FormAlert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        You can ask this organization to remove your personal details. Your name, email, phone and
        address are erased, any saved cards are removed, and recurring gifts are cancelled.
      </p>
      <p className="text-sm text-muted-foreground">
        <strong className="text-foreground">
          Receipts already issued to you are kept, and are not erased.
        </strong>{" "}
        Canadian charities are legally required to retain them, and they keep the name and address
        they were issued with so the charity&apos;s records stay valid for the CRA.
        {receiptCount > 0 && ` You have ${receiptCount} on file.`}
      </p>

      {result?.error && <FormAlert>{result.error}</FormAlert>}

      <div>
        <ConfirmButton
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
          title="Remove your personal details?"
          description={
            <>
              This erases your name, email, phone and address, removes saved payment methods, and
              cancels any recurring gift. It cannot be undone, and you&apos;ll be signed out.
              <br />
              <br />
              Receipts already issued to you are retained as the law requires — download anything you
              need first, because you won&apos;t be able to sign in afterwards.
            </>
          }
          confirmLabel="Remove my details"
          destructive
          onConfirm={() => start(async () => setResult(await requestMyErasure()))}
        >
          Remove my details
        </ConfirmButton>
      </div>
    </div>
  );
}
