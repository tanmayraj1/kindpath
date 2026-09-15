import "server-only";
import { createHash } from "node:crypto";
import { adminDb } from "@/lib/db";
import { issueResetToken } from "./password-reset";
import { sendEmailWithRetry, emailLayout, escapeHtml } from "@/lib/email";
import { captureError } from "@/lib/observability";
import { appUrl as deploymentUrl } from "@/lib/app-url";

/**
 * Email verification — built, recorded, and gating nothing yet.
 *
 * The deliberate shape: `emailVerifiedAt` is stamped from signup onward and this
 * module can issue and consume the link, but no route refuses an unverified
 * user. That makes turning verification into a requirement later a policy change
 * rather than a migration that would lock out every account created before the
 * feature existed and never had the chance to verify.
 *
 * Reuses PasswordResetToken with purpose "verify": same single-use semantics,
 * same SHA-256-at-rest so a database dump can't be replayed, and superseding is
 * scoped per purpose so this and a password reset don't cancel each other.
 */

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function verifyUrl(token: string): string {
  const base = deploymentUrl();
  return `${base}/verify?token=${encodeURIComponent(token)}`;
}

/**
 * Issue a verification link and email it.
 *
 * Never throws: signup must not fail because a mail provider is down. A missing
 * verification email is recoverable — the user can request another — whereas a
 * failed signup loses the customer.
 */
export async function sendEmailVerification(args: {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  orgName: string;
  brandColor?: string | null;
  logoUrl?: string | null;
}): Promise<{ url: string; emailed: boolean }> {
  const { token } = await issueResetToken({
    principal: "org",
    principalId: args.userId,
    orgId: args.orgId,
    purpose: "verify",
  });
  const url = verifyUrl(token);

  let emailed = false;
  try {
    const result = await sendEmailWithRetry({
      to: args.email,
      subject: `Confirm your email for ${args.orgName}`,
      html: emailLayout({
        heading: `Welcome, ${escapeHtml(args.name.split(" ")[0] ?? "")}!`,
        body:
          `Please confirm this is your email address so we can send receipts, ` +
          `billing notices and password resets to the right place. The link is ` +
          `good for seven days.`,
        cta: { label: "Confirm my email", url },
        brand: { orgName: args.orgName, brandColor: args.brandColor, logoUrl: args.logoUrl },
      }),
    });
    emailed = result.ok;
    // Returned, not thrown — but it must not vanish. A Resend rejection (wrong
    // EMAIL_FROM domain, revoked key) otherwise leaves no trace anywhere.
    if (!result.ok) {
      captureError(new Error(result.error), { source: "auth.sendEmailVerification", userId: args.userId });
    }
  } catch (e) {
    captureError(e, { source: "auth.sendEmailVerification", userId: args.userId });
  }

  return { url, emailed };
}

export type VerifyResult =
  | { ok: true; alreadyVerified: boolean }
  | { ok: false; reason: "invalid" | "expired" | "used" };

/**
 * Consume a verification token. Single-use and time-limited, like every other
 * token in this table.
 */
export async function consumeEmailVerification(rawToken: string): Promise<VerifyResult> {
  if (!rawToken) return { ok: false, reason: "invalid" };

  const row = await adminDb.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(rawToken) },
  });
  if (!row || row.purpose !== "verify") return { ok: false, reason: "invalid" };
  if (row.usedAt) return { ok: false, reason: "used" };
  if (row.expiresAt < new Date()) return { ok: false, reason: "expired" };

  const user = await adminDb.orgUser.findUnique({ where: { id: row.principalId } });
  if (!user) return { ok: false, reason: "invalid" };

  const alreadyVerified = user.emailVerifiedAt != null;

  await adminDb.$transaction([
    adminDb.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    adminDb.orgUser.update({
      where: { id: user.id },
      // Keep the FIRST verification time; re-clicking an older link shouldn't
      // rewrite when this address was actually proven.
      data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    }),
  ]);

  return { ok: true, alreadyVerified };
}
