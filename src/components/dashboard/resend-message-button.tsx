"use client";

import { Send } from "lucide-react";
import { resendFailedMessage } from "@/app/(dashboard)/dashboard/actions";
import { ActionButton } from "@/components/ui/action-button";

/**
 * Retry a message that never reached the donor.
 *
 * The failures panel showed what had failed and told the org to "re-issue" it,
 * with no mechanism in the product to do so — while `resendNotification` sat in
 * the codebase with no caller.
 */
export function ResendMessageButton({ notificationId }: { notificationId: string }) {
  return (
    <ActionButton variant="outline" size="sm" action={() => resendFailedMessage(notificationId)}>
      <Send className="size-4" aria-hidden /> Send again
    </ActionButton>
  );
}
