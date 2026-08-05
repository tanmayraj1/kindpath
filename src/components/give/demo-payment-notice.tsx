import { Lock } from "lucide-react";

/**
 * Shown in place of a checkout when no payment provider is connected.
 *
 * These flows previously rendered a full card form — number, expiry, CVC,
 * pre-filled with 4242… — that collected nothing and charged nothing. On a
 * public, org-branded page that is a fake checkout: it teaches donors that a
 * page asking for their card without taking it is normal. Say what's happening
 * instead, and ask for nothing.
 */
export function DemoPaymentNotice() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-warning/30 bg-warning/5 p-4">
      <Lock className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="text-sm">
        <p className="font-medium text-foreground">
          This organization has no payment provider connected yet.
        </p>
        <p className="mt-1 text-muted-foreground">
          No card is collected and no money moves. Continuing simulates an approved payment so the
          receipt flow can be demonstrated end to end.
        </p>
      </div>
    </div>
  );
}
