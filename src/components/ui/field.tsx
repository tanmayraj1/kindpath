import * as React from "react";
import { Input, type InputProps } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FieldErrors } from "@/lib/validation";

/**
 * A labelled input wired to server-side validation.
 *
 * Ties the label, the error message and the input together with the attributes
 * assistive technology actually reads: `aria-invalid` marks the field, and
 * `aria-describedby` points at the message so it's announced when focus lands —
 * rather than the message existing only as red text somewhere on the page.
 */
export function Field({
  name,
  label,
  errors,
  hint,
  className,
  ...inputProps
}: InputProps & {
  name: string;
  label: string;
  errors?: FieldErrors;
  hint?: string;
}) {
  const error = errors?.[name];
  const errorId = `${name}-error`;
  const hintId = `${name}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ");

  return (
    <div className={`flex flex-col gap-2 ${className ?? ""}`}>
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
