import type { z } from "zod";

/**
 * Turn a Zod failure into something a form can actually show.
 *
 * Every action in the app reported `error.issues[0]?.message` — one message, for
 * one field, with no indication of which field it belonged to. A donor who left
 * three required fields blank fixed one, resubmitted, and was told about the
 * next. On a donation form that is a real chance to lose the gift.
 */
export type FieldErrors = Record<string, string>;

export type FormErrors = {
  /** Per-field messages, keyed by input name — drives aria-invalid on the field. */
  fields: FieldErrors;
  /** One-line summary for the alert region at the top of the form. */
  message: string;
};

export function formErrors(error: z.ZodError): FormErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    // Keep the FIRST message per field: Zod can emit several for one input
    // (too_small then invalid_format) and the first is the actionable one.
    if (!fields[key]) fields[key] = issue.message;
  }

  const messages = Object.values(fields);
  const message =
    messages.length === 0
      ? "Please check your details."
      : messages.length === 1
        ? messages[0]
        : `Please fix ${messages.length} fields below.`;

  return { fields, message };
}

/** Convenience for actions that only need the summary line. */
export function firstMessage(error: z.ZodError): string {
  return formErrors(error).message;
}
