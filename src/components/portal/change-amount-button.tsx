"use client";

import { updatePlanAmount } from "@/app/portal/actions";
import { EditDialog } from "@/components/ui/edit-dialog";

/**
 * Change what a recurring gift gives each period.
 *
 * The billing cron reads the plan's amount at charge time, so the next scheduled
 * gift uses the new figure — nothing is charged now.
 */
export function ChangeAmountButton({
  planId,
  amount,
  frequency,
}: {
  planId: string;
  amount: number;
  frequency: string;
}) {
  return (
    <EditDialog
      variant="outline"
      size="sm"
      title="Change your gift amount"
      description={`Takes effect on your next ${frequency} gift — nothing is charged now. You can change it again whenever you like.`}
      action={updatePlanAmount}
      values={{ planId }}
      submitLabel="Save amount"
      trigger={<>Change amount</>}
      fields={[
        {
          name: "amount",
          kind: "number",
          label: "Amount (CAD)",
          value: amount,
          required: true,
          step: "0.01",
          min: "1",
        },
      ]}
    />
  );
}
