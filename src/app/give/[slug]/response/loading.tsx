import { Loader2 } from "lucide-react";

/**
 * The donor lands here straight from the gateway while we confirm server-side.
 * A blank screen at this exact moment reads as a failed payment, so say what's
 * happening and explicitly ask them not to leave.
 */
export default function Loading() {
  return (
    <div className="grid min-h-dvh place-items-center p-6" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-center">
        <Loader2 className="size-8 animate-spin text-brand-600" aria-hidden />
        <p className="font-display text-lg font-semibold">Confirming your payment…</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Please don&apos;t close this window or press back — we&apos;re checking with your bank.
        </p>
      </div>
    </div>
  );
}
