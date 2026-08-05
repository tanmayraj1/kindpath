"use client";

import { useState, useTransition } from "react";
import { FilePlus2, CheckCircle2, RefreshCw, Loader2 } from "lucide-react";
import {
  issueInvoiceNow,
  markInvoicePaidAction,
  runSubscriptionCycleNow,
  type InvoiceState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";

export function InvoiceActions({
  orgId,
  orgName,
  latestInvoiceId,
  latestInvoicePaid,
}: {
  orgId: string;
  orgName: string;
  latestInvoiceId: string | null;
  latestInvoicePaid: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<InvoiceState | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex justify-end gap-1.5">
        <ConfirmButton
          variant="outline"
          size="sm"
          disabled={pending}
          title={`Issue this period's invoice for ${orgName}?`}
          description="Creates a numbered invoice with the correct provincial tax. If one has already been issued for this period, nothing happens — invoice numbers are never reused."
          confirmLabel="Issue invoice"
          onConfirm={() => start(async () => setResult(await issueInvoiceNow(orgId)))}
        >
          <FilePlus2 className="size-4" aria-hidden />
          <span className="sr-only">Issue invoice</span>
        </ConfirmButton>

        {latestInvoiceId && !latestInvoicePaid && (
          <ConfirmButton
            variant="outline"
            size="sm"
            disabled={pending}
            className="border-success/30 text-success hover:bg-success/10"
            title="Record payment for the latest invoice?"
            description="Marks it paid and returns the subscription to active, starting the next billing period. Use this after the money has actually arrived."
            confirmLabel="Mark paid"
            onConfirm={() =>
              start(async () => setResult(await markInvoicePaidAction(latestInvoiceId)))
            }
          >
            <CheckCircle2 className="size-4" aria-hidden />
            <span className="sr-only">Mark paid</span>
          </ConfirmButton>
        )}
      </div>

      {result?.error && <FormAlert className="max-w-xs text-left">{result.error}</FormAlert>}
      {result?.ok && (
        <FormAlert variant="success" className="max-w-xs text-left">
          {result.message}
        </FormAlert>
      )}
    </div>
  );
}

export function RunSubscriptionCycleButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<InvoiceState | null>(null);

  return (
    <div className="flex items-center gap-2">
      {result?.message && (
        <span className="hidden text-xs text-muted-foreground sm:inline">{result.message}</span>
      )}
      {result?.error && <span className="hidden text-xs text-destructive sm:inline">{result.error}</span>}
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() => start(async () => setResult(await runSubscriptionCycleNow()))}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <RefreshCw className="size-4" aria-hidden />
        )}
        Run cycle
      </Button>
    </div>
  );
}
