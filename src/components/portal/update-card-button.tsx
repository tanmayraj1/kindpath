"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { beginCardUpdate } from "@/app/portal/actions";
import { Button } from "@/components/ui/button";
import { formatCAD } from "@/lib/utils";

/**
 * Pay a recurring gift with a different card.
 *
 * The gift's amount is charged on the new card rather than the card merely being
 * stored, because that is what both gateways support — WeVend's reusable token
 * IS a completed sale — and because the donor reaching for this button is
 * usually one whose payment just failed, so it also collects the missed gift.
 * The amount is stated on the button so that is never a surprise.
 */
export function UpdateCardButton({
  planId,
  amount,
  variant = "outline",
}: {
  planId: string;
  amount: number;
  variant?: "outline" | "primary";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={variant}
        size="sm"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await beginCardUpdate(planId);
            if (!r.ok) {
              setError(r.message);
              return;
            }
            // A full-page navigation, not an iframe — the gateway's own page
            // must own the card fields, which is also why the CSP can keep
            // frame-src at 'none'.
            window.location.assign(r.redirectTo);
          })
        }
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <CreditCard className="size-4" aria-hidden />
        )}
        Pay {formatCAD(amount, { maximumFractionDigits: 0 })} with a new card
      </Button>
      {error && (
        <p role="alert" className="max-w-xs text-right text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
