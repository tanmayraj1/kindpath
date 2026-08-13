"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export type MutationResult = { ok?: boolean; error?: string };

/**
 * A button that runs a server action and reports what happened.
 *
 * Most one-shot mutations in the dashboard were wired as
 * `onClick={() => start(() => someAction(id))}` against actions returning
 * `Promise<void>`. The action quietly did nothing whenever the record wasn't
 * found, so a stale page, a row deleted in another tab, or a scoping mistake all
 * produced a spinner, a revalidate, and no change — indistinguishable from
 * success. This surfaces the failure where the user is looking.
 *
 * Pass `confirm` for destructive actions to require an explicit confirmation
 * first; without it the action fires immediately.
 */
export function ActionButton({
  action,
  confirm,
  onDone,
  children,
  className,
  ...buttonProps
}: Omit<ButtonProps, "onClick" | "action"> & {
  action: () => Promise<MutationResult | void>;
  confirm?: {
    title: string;
    description?: React.ReactNode;
    confirmLabel?: string;
    destructive?: boolean;
  };
  onDone?: (result: MutationResult) => void;
  children: React.ReactNode;
}) {
  const [pending, start] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function run() {
    setError(null);
    start(async () => {
      try {
        const result = (await action()) ?? {};
        if (result.error) setError(result.error);
        onDone?.(result);
      } catch {
        // A thrown action (network drop, redeploy mid-click) must not leave the
        // button looking like it succeeded.
        setError("Something went wrong. Please try again.");
      } finally {
        setOpen(false);
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        {...buttonProps}
        type="button"
        className={cn(className)}
        disabled={pending || buttonProps.disabled}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </Button>

      {confirm && (
        <ConfirmDialog
          open={open}
          title={confirm.title}
          description={confirm.description}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          pending={pending}
          onCancel={() => setOpen(false)}
          onConfirm={run}
        />
      )}

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
