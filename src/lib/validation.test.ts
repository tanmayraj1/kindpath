import { describe, it, expect } from "vitest";
import { z } from "zod";
import { formErrors, firstMessage } from "./validation";

const schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Enter a valid email"),
  postalCode: z.string().min(3, "Postal code is required"),
});

function fail(input: unknown) {
  const r = schema.safeParse(input);
  if (r.success) throw new Error("expected a validation failure");
  return r.error;
}

describe("formErrors", () => {
  it("reports every invalid field, not just the first", () => {
    const { fields } = formErrors(fail({ firstName: "", lastName: "", email: "nope", postalCode: "" }));
    expect(Object.keys(fields).sort()).toEqual(["email", "firstName", "lastName", "postalCode"]);
    expect(fields.email).toBe("Enter a valid email");
  });

  it("keys errors by input name so a field can be marked invalid", () => {
    const { fields } = formErrors(fail({ firstName: "Ada", lastName: "L", email: "x", postalCode: "M4B" }));
    expect(fields).toEqual({ email: "Enter a valid email" });
  });

  it("shows the single message verbatim when only one field failed", () => {
    expect(formErrors(fail({ firstName: "Ada", lastName: "L", email: "x", postalCode: "M4B" })).message).toBe(
      "Enter a valid email"
    );
  });

  it("summarizes when several fields failed", () => {
    expect(formErrors(fail({ firstName: "", lastName: "", email: "x", postalCode: "" })).message).toBe(
      "Please fix 4 fields below."
    );
  });

  it("keeps only the first message per field", () => {
    const s = z.object({ pw: z.string().min(10, "Too short").regex(/\d/, "Needs a digit") });
    const r = s.safeParse({ pw: "abc" });
    if (r.success) throw new Error("expected failure");
    expect(formErrors(r.error).fields.pw).toBe("Too short");
  });

  it("handles a top-level refine with no path", () => {
    const s = z
      .object({ a: z.string(), b: z.string() })
      .refine((v) => v.a === v.b, { message: "Values must match" });
    const r = s.safeParse({ a: "x", b: "y" });
    if (r.success) throw new Error("expected failure");
    const { fields, message } = formErrors(r.error);
    expect(fields._form).toBe("Values must match");
    expect(message).toBe("Values must match");
  });

  it("firstMessage matches the summary line", () => {
    const e = fail({ firstName: "", lastName: "", email: "x", postalCode: "" });
    expect(firstMessage(e)).toBe(formErrors(e).message);
  });
});
