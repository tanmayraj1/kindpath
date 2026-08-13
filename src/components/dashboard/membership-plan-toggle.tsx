"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { setMembershipPlanActive } from "@/app/(dashboard)/dashboard/actions";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Retire a membership plan from the public join page.
 *
 * Deliberately does not touch existing members: their recurring gifts continue
 * on the terms they agreed to. Retiring a plan only stops new people joining it.
 */
export function MembershipPlanToggle({
  planId,
  name,
  isActive,
  members,
}: {
  planId: string;
  name: string;
  isActive: boolean;
  members: number;
}) {
  return (
    <ActionButton
      variant="ghost"
      size="sm"
      action={() => setMembershipPlanActive(planId, !isActive)}
      confirm={
        isActive
          ? {
              title: `Retire “${name}”?`,
              description:
                members > 0
                  ? `New people won't be able to join this plan. The ${members} current member${members === 1 ? "" : "s"} keep${members === 1 ? "s" : ""} their membership and continue to be billed as agreed.`
                  : "New people won't be able to join this plan. You can bring it back at any time.",
              confirmLabel: "Retire plan",
            }
          : undefined
      }
    >
      {isActive ? (
        <Archive className="size-4" aria-hidden />
      ) : (
        <ArchiveRestore className="size-4" aria-hidden />
      )}
      <span className="sr-only">{isActive ? "Retire plan" : "Reactivate plan"}</span>
    </ActionButton>
  );
}
