"use server";

import { z } from "zod";
import { sendEmail, emailLayout, escapeHtml } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type ContactState = { error?: string; ok?: boolean };

const schema = z.object({
  name: z.string().min(2, "Your name is required").max(100),
  email: z.string().email("Enter a valid email").max(254),
  org: z.string().max(150).optional(),
  message: z.string().min(5, "Tell us a little about your needs").max(5000),
});

export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  if (!(await rateLimit(`contact:${clientIp()}`, 5, 60_000)).ok) {
    return { error: "Too many requests. Please wait a minute and try again." };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const d = parsed.data;

  const to = process.env.CONTACT_TO ?? process.env.EMAIL_FROM ?? "sales@kindpath.app";
  await sendEmail({
    to,
    subject: `New demo request from ${d.name}${d.org ? ` (${d.org})` : ""}`,
    html: emailLayout({
      heading: "New demo / contact request",
      body: `<p><strong>Name:</strong> ${escapeHtml(d.name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(d.email)}</p>
        ${d.org ? `<p><strong>Organization:</strong> ${escapeHtml(d.org)}</p>` : ""}
        <p><strong>Message:</strong><br/>${escapeHtml(d.message).replace(/\n/g, "<br/>")}</p>`,
    }),
  });

  return { ok: true };
}
