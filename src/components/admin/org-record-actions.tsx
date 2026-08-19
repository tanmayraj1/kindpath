"use client";

import { Pause, Play, X, Ban } from "lucide-react";
import { adminSetPlanStatus, adminVoidReceipt } from "@/app/admin/actions";
import { ActionButton } from "@/components/ui/action-button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { useState, useTransition } from "react";
import { FormAlert } from "@/components/ui/form-alert";

/**
 * Support acting on an org's own records.
 *
 * These two tabs were read-only while the org's staff had controls for the same
 * data — so support could see a stuck recurring gift or a wrong receipt and do
 * nothing about either, which are the two things they get called about.
 */
export function AdminPlanControls({
  orgId,
  planId,
  status,
}: {
  orgId: string;
  planId: string;
  status: string;
}) {
  if (status === "cancelled") return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex justify-end gap-1.5">
      {status === "active" ? (
        <ActionButton
          variant="outline"
          size="sm"
          action={() => adminSetPlanStatus(orgId, planId, "pause")}
        >
          <Pause className="size-4" aria-hidden /> Pause
        </ActionButton>
      ) : (
        <ActionButton
          variant="outline"
          size="sm"
          action={() => adminSetPlanStatus(orgId, planId, "resume")}
        >
          <Play className="size-4" aria-hidden /> Resume
        </ActionButton>
      )}
      <ActionButton
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        action={() => adminSetPlanStatus(orgId, planId, "cancel")}
        confirm={{
          title: "Cancel this donor's recurring gift?",
          description:
            "You're acting inside the organization's account and this is recorded against your name. No further donations will be collected, and the donor would have to set up a new gift.",
          confirmLabel: "Cancel plan",
          destructive: true,
        }}
      >
        <X className="size-4" aria-hidden />
        <span className="sr-only">Cancel plan</span>
      </ActionButton>
    </div>
  );
}

export function AdminVoidReceiptButton({
  orgId,
  receiptId,
  serial,
  status,
}: {
  orgId: string;
  receiptId: string;
  serial: string;
  status: string;
}) {
  const [result, setResult] = useState<{ error?: string; ok?: boolean } | null>(null);
  const [, start] = useTransition();

  if (status !== "issued") return <span className="text-xs text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col items-end gap-1">
      <ConfirmButton
        variant="ghost"
        size="sm"
        className="text-destructive hover:bg-destructive/10"
        title={`Void receipt ${serial}?`}
        description="An official receipt is a CRA document. Voiding is permanent, the reason is kept with it, and this is recorded against your name as a platform admin acting inside the organization."
        confirmLabel="Void receipt"
        destructive
        reasonLabel="Reason"
        reasonPlaceholder="e.g. issued to the wrong donor"
        onConfirm={(reason) =>
          start(async () => setResult(await adminVoidReceipt(orgId, receiptId, reason)))
        }
      >
        <Ban className="size-4" aria-hidden /> Void
      </ConfirmButton>
      {result?.error && <FormAlert className="max-w-xs">{result.error}</FormAlert>}
    </div>
  );
}
