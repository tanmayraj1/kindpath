"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { updateFund, setFundArchived } from "@/app/(dashboard)/dashboard/actions";
import { EditDialog } from "@/components/ui/edit-dialog";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Edit and archive a fund. Funds are archived rather than deleted: donations and
 * receipts reference them, and a receipt must keep showing the fund the gift was
 * designated to.
 */
export function FundRowActions({
  fund,
}: {
  fund: { id: string; name: string; code: string | null; isActive: boolean };
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <EditDialog
        title="Edit fund"
        description="Renaming a fund updates it everywhere, including on the giving page. Receipts already issued keep the name they were issued with."
        action={updateFund}
        values={{ id: fund.id }}
        fields={[
          { name: "name", label: "Fund name", value: fund.name, required: true },
          {
            name: "code",
            label: "Code",
            value: fund.code,
            hint: "Optional short code for your bookkeeping.",
          },
        ]}
      />
      <ActionButton
        variant="ghost"
        size="sm"
        action={() => setFundArchived(fund.id, fund.isActive)}
        confirm={
          fund.isActive
            ? {
                title: `Archive “${fund.name}”?`,
                description:
                  "Donors will no longer be able to choose it on your giving page. Gifts already designated to it, and their receipts, are unchanged. You can restore it at any time.",
                confirmLabel: "Archive fund",
              }
            : undefined
        }
      >
        {fund.isActive ? (
          <Archive className="size-4" aria-hidden />
        ) : (
          <ArchiveRestore className="size-4" aria-hidden />
        )}
        <span className="sr-only">{fund.isActive ? "Archive fund" : "Restore fund"}</span>
      </ActionButton>
    </div>
  );
}
