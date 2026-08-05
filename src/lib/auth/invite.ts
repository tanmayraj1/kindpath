import "server-only";
import { randomBytes } from "node:crypto";
import { hashPassword } from "./password";
import { issueResetToken, resetUrl, type Principal } from "./password-reset";
import { sendEmailWithRetry, emailLayout, escapeHtml } from "@/lib/email";
import { captureError } from "@/lib/observability";

/**
 * Account invitations and administrative password resets.
 *
 * Replaces a shared static temporary password (`ChangeMe123!`) that every invited
 * user on every tenant received. That value was, in effect, a master key: anyone
 * who learned it could try it against any newly-invited address on the platform,
 * and nothing forced a change.
 *
 * Instead: the account is created with an unguessable random password nobody ever
 * sees, `mustChangePassword` is set, and the person receives a single-use link
 * that expires. The admin never handles a password at all.
 */

/**
 * A password nobody knows, including us. Accounts are unusable until the invitee
 * follows their link — there is no value here for an admin to read out or leak.
 */
export async function unusablePasswordHash(): Promise<string> {
  return hashPassword(randomBytes(32).toString("base64url"));
}

export type InviteResult = {
  /** True when the invitation email was accepted by the provider. */
  emailed: boolean;
  /** The link itself, so an admin can pass it on if email is misconfigured. */
  url: string;
};

export async function sendInvite(args: {
  principal: Principal;
  principalId: string;
  orgId?: string | null;
  email: string;
  name: string;
  orgName?: string | null;
  brandColor?: string | null;
  logoUrl?: string | null;
  /** "invite" for a new account (7 days), "reset" for an admin-triggered reset (1 hour). */
  purpose: "invite" | "reset";
}): Promise<InviteResult> {
  const { token } = await issueResetToken({
    principal: args.principal,
    principalId: args.principalId,
    orgId: args.orgId,
    purpose: args.purpose,
  });
  const url = resetUrl(token);
  const isInvite = args.purpose === "invite";

  const html = emailLayout({
    heading: isInvite
      ? `You've been invited to ${escapeHtml(args.orgName ?? "KindPath")}`
      : "Set a new password",
    body: isInvite
      ? `Hi ${escapeHtml(args.name.split(" ")[0] ?? "")}, an account has been created for you
         at <strong>${escapeHtml(args.orgName ?? "KindPath")}</strong>. Choose your password to
         get started — this link works once and expires in 7 days.`
      : `An administrator reset the password for <strong>${escapeHtml(args.email)}</strong>.
         Choose a new one using the link below. It works once and expires in one hour.`,
    cta: { label: isInvite ? "Set your password" : "Choose a new password", url },
    brand: { orgName: args.orgName ?? undefined, brandColor: args.brandColor, logoUrl: args.logoUrl },
  });

  try {
    const result = await sendEmailWithRetry({
      to: args.email,
      subject: isInvite
        ? `Set up your ${args.orgName ?? "KindPath"} account`
        : "Set a new KindPath password",
      html,
    });
    if (!result.ok) {
      captureError(new Error(`invite email failed: ${result.error}`), {
        source: "auth.sendInvite",
        principal: args.principal,
        orgId: args.orgId,
      });
    }
    return { emailed: result.ok, url };
  } catch (e) {
    captureError(e, { source: "auth.sendInvite", principal: args.principal, orgId: args.orgId });
    return { emailed: false, url };
  }
}
