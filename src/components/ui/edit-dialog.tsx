"use client";

import * as React from "react";
import { useFormState } from "react-dom";
import { Pencil, X } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { FormAlert } from "@/components/ui/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import type { FieldErrors } from "@/lib/validation";

export type EditFieldSpec =
  | {
      kind?: "text" | "number" | "date" | "email" | "color";
      name: string;
      label: string;
      value?: string | number | null;
      required?: boolean;
      hint?: string;
      step?: string;
      min?: string;
      placeholder?: string;
    }
  | {
      kind: "textarea";
      name: string;
      label: string;
      value?: string | null;
      required?: boolean;
      hint?: string;
      rows?: number;
      placeholder?: string;
    }
  | {
      kind: "select";
      name: string;
      label: string;
      value?: string | null;
      required?: boolean;
      hint?: string;
      options: { value: string; label: string }[];
    };

type State = { ok?: boolean; error?: string; fields?: FieldErrors };

/**
 * Edit an existing record in place.
 *
 * Nine entity types in this app could be created and never corrected — a
 * mistyped ticket price or event date was permanent, and the only workaround was
 * to create a second one and leave the wrong one live on the public page. Rather
 * than nine bespoke dialogs, this renders the fields a caller declares and posts
 * them to that caller's own server action.
 *
 * Field-level errors from the action are threaded back to the matching input, so
 * a form with three problems shows all three rather than reporting them one at a
 * time across three round trips.
 */
export function EditDialog({
  title,
  description,
  fields,
  action,
  values,
  trigger,
  submitLabel = "Save changes",
  ...buttonProps
}: Omit<ButtonProps, "action"> & {
  title: string;
  description?: React.ReactNode;
  fields: EditFieldSpec[];
  action: (prev: State, formData: FormData) => Promise<State>;
  /** Values posted with the form but not shown (ids, parent keys). */
  values?: Record<string, string>;
  trigger?: React.ReactNode;
  submitLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useFormState(action, {} as State);
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreTo = React.useRef<HTMLElement | null>(null);

  // Close once the action reports success, so the dialog doesn't sit open over a
  // list that has already updated behind it.
  React.useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state.ok]);

  React.useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreTo.current?.focus?.();
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        {...buttonProps}
        type="button"
        onClick={() => setOpen(true)}
      >
        {trigger ?? (
          <>
            <Pencil className="size-4" aria-hidden />
            <span className="sr-only">Edit</span>
          </>
        )}
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-foreground/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-lg font-bold">{title}</h2>
                {description && (
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-secondary"
              >
                <X className="size-4" aria-hidden />
                <span className="sr-only">Close</span>
              </button>
            </div>

            <form action={formAction} className="flex flex-col gap-4">
              {Object.entries(values ?? {}).map(([k, v]) => (
                <input key={k} type="hidden" name={k} value={v} />
              ))}

              {state.error && <FormAlert>{state.error}</FormAlert>}

              {fields.map((f) => {
                if (f.kind === "select") {
                  const err = state.fields?.[f.name];
                  return (
                    <div key={f.name} className="flex flex-col gap-2">
                      <Label htmlFor={f.name}>{f.label}</Label>
                      <select
                        id={f.name}
                        name={f.name}
                        defaultValue={f.value ?? ""}
                        aria-invalid={err ? true : undefined}
                        className="flex h-11 w-full rounded-lg border border-input bg-background px-3.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      >
                        {f.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                      {err && <p className="text-xs font-medium text-destructive">{err}</p>}
                    </div>
                  );
                }
                if (f.kind === "textarea") {
                  const err = state.fields?.[f.name];
                  return (
                    <div key={f.name} className="flex flex-col gap-2">
                      <Label htmlFor={f.name}>{f.label}</Label>
                      <textarea
                        id={f.name}
                        name={f.name}
                        rows={f.rows ?? 4}
                        defaultValue={f.value ?? ""}
                        placeholder={f.placeholder}
                        required={f.required}
                        aria-invalid={err ? true : undefined}
                        className="w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm focus-visible:border-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                      />
                      {err && <p className="text-xs font-medium text-destructive">{err}</p>}
                    </div>
                  );
                }
                return (
                  <Field
                    key={f.name}
                    name={f.name}
                    label={f.label}
                    type={f.kind ?? "text"}
                    defaultValue={f.value ?? ""}
                    required={f.required}
                    hint={f.hint}
                    step={f.step}
                    min={f.min}
                    placeholder={f.placeholder}
                    errors={state.fields}
                  />
                );
              })}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <SubmitButton>{submitLabel}</SubmitButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
