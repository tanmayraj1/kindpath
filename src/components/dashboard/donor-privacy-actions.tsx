"use client";

import { useState, useTransition } from "react";
import { Download, UserX } from "lucide-react";
import {
  anonymizeDonorRecord,
  exportDonorRecord,
  type PrivacyState,
} from "@/app/(dashboard)/dashboard/actions";
import { Button } from "@/components/ui/button";
import { ConfirmButton } from "@/components/ui/confirm-dialog";
import { FormAlert } from "@/components/ui/form-alert";

/**
 * Handling a donor's access or erasure request (PIPEDA / Law 25).
 *
 * The organization is the one legally answerable to the donor, so it needs these
 * controls directly — routing every request through KindPath support would make
 * the org unable to meet its own statutory response deadlines.
 */
export function DonorPrivacyActions({
  donorId,
  donorName,
  anonymized,
}: {
  donorId: string;
  donorName: string;
  anonymized: boolean;
}) {
  const [, start] = useTransition();
  const [result, setResult] = useState<(PrivacyState & { json?: string }) | null>(null);

  function download(json: string) {
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `donor-data-${donorId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (anonymized) {
    return (
      <FormAlert variant="info">
        This donor asked to be removed. Their personal details are erased; their donations and
        receipts are retained as the Income Tax Act requires, showing the name and address each
        receipt was issued with.
      </FormAlert>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            start(async () => {
              const r = await exportDonorRecord(donorId);
              setResult(r);
              if (r.json) download(r.json);
            })
          }
        >
          <Download className="size-4" aria-hidden /> Export their data
        </Button>

        <ConfirmButton
          variant="outline"
          size="sm"
          className="border-destructive/30 text-destructive hover:bg-destructive/10"
          title={`Remove ${donorName}'s personal details?`}
          description={
            <>
              Erases their name, email, phone and address, removes saved payment methods, and
              cancels any recurring gift. It cannot be undone.
              <br />
              <br />
              Their donations and receipts are <strong>retained</strong> — you are required to keep
              them, and each receipt keeps the name and address it was issued with, so your CRA
              records stay intact.
            </>
          }
          confirmLabel="Remove personal details"
          destructive
          onConfirm={() => start(async () => setResult(await anonymizeDonorRecord(donorId)))}
        >
          <UserX className="size-4" aria-hidden /> Handle erasure request
        </ConfirmButton>
      </div>

      {result?.error && <FormAlert>{result.error}</FormAlert>}
      {result?.ok && result.message && (
        <FormAlert variant="success">{result.message}</FormAlert>
      )}
    </div>
  );
}
