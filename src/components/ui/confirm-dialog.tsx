"use client";

import * as React from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Accessible replacement for window.confirm / window.prompt.
 *
 * The native dialogs block the main thread, can't be styled or branded, are
 * suppressed outright by some browsers and embedded webviews (so a destructive
 * action would silently no-op), and give a screen-reader user no context beyond
 * a bare string. This renders a real modal: focus moves in, Escape and the
 * backdrop close it, Tab is trapped, and focus returns where it started.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  pending = false,
  /** When set, the user must type a reason; passed to onConfirm. */
  reasonLabel,
  reasonPlaceholder,
  reasonRequired = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  reasonRequired?: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);
  const [reason, setReason] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    setReason("");

    // Move focus into the dialog so keyboard and screen-reader users land here.
    const focusables = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => !el.hasAttribute("disabled"));

    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreTo.current?.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  const blocked = !!reasonLabel && reasonRequired && reason.trim().length === 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={panelRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby={description ? "confirm-desc" : undefined}
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
      >
        <div className="flex items-start gap-3">
          {destructive && (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="size-5" aria-hidden />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="font-display text-base font-semibold">
              {title}
            </h2>
            {description && (
              <div id="confirm-desc" className="mt-1.5 text-sm text-muted-foreground">
                {description}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {reasonLabel && (
          <div className="mt-4 flex flex-col gap-2">
            <Label htmlFor="confirm-reason">{reasonLabel}</Label>
            <Input
              id="confirm-reason"
              value={reason}
              placeholder={reasonPlaceholder}
              onChange={(e) => setReason(e.target.value)}
              required={reasonRequired}
            />
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel} disabled={pending} type="button">
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "primary"}
            disabled={pending || blocked}
            onClick={() => onConfirm(reason.trim())}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Button that opens a ConfirmDialog and runs `onConfirm` when accepted.
 * Covers the common "one destructive button" case without repeating state.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  destructive,
  reasonLabel,
  reasonPlaceholder,
  onConfirm,
  children,
  className,
  ...buttonProps
}: Omit<ButtonProps, "onClick"> & {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  return (
    <>
      <Button
        {...buttonProps}
        type="button"
        className={cn(className)}
        onClick={() => setOpen(true)}
        disabled={pending || buttonProps.disabled}
      >
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        destructive={destructive}
        pending={pending}
        reasonLabel={reasonLabel}
        reasonPlaceholder={reasonPlaceholder}
        onCancel={() => setOpen(false)}
        onConfirm={(reason) => {
          setOpen(false);
          startTransition(() => {
            void onConfirm(reason);
          });
        }}
      />
    </>
  );
}
