"use client";

import { MailCheck, Link2 } from "lucide-react";
import { CopyButton } from "./copy-button";

/**
 * Result of an invitation or admin password reset.
 *
 * There is no password to display — the account is created unusable and the
 * recipient sets their own via a single-use link. When email delivery isn't
 * configured or fails, we surface the link so the admin can pass it on
 * out-of-band rather than being left with a silently dead invitation.
 */
export function InviteNotice({
  emailed,
  url,
  email,
  what = "Invitation",
}: {
  emailed?: boolean;
  url?: string;
  email?: string;
  what?: string;
}) {
  if (!url) return null;

  if (emailed) {
    return (
      <div
        role="status"
        className="flex items-start gap-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2.5 text-sm text-success"
      >
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {what} sent{email ? ` to ${email}` : ""}. The link works once and expires — no password
          was created.
        </span>
      </div>
    );
  }

  return (
    <div
      role="status"
      className="flex flex-col gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm"
    >
      <span className="flex items-start gap-2 text-foreground">
        <Link2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {what} created, but the email couldn&apos;t be delivered. Send this single-use link
          directly — it expires, and it&apos;s the only way in.
        </span>
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1.5 font-mono text-xs">
          {url}
        </code>
        <CopyButton value={url} />
      </div>
    </div>
  );
}
