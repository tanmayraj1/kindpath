"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import type { SessionClaims } from "@/lib/auth/jwt";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/auth/totp";
import { isLocked, lockMinutesRemaining, registerFailure, registerSuccess } from "@/lib/auth/lockout";
import { issueResetToken, consumeResetToken, resetUrl } from "@/lib/auth/password-reset";
import { getSession } from "@/lib/auth/session";
import { revokeSessions } from "@/lib/auth/revocation";
import { sendEmailWithRetry, emailLayout, escapeHtml } from "@/lib/email";
import { audit } from "@/lib/audit";
import { captureError } from "@/lib/observability";
import {
  createTwoFactorTicket,
  readTwoFactorTicket,
  clearTwoFactorTicket,
} from "@/lib/auth/twofa-ticket";

export type AuthState = { error?: string };

const portalFor: Record<SessionClaims["kind"], string> = {
  platform: "/admin",
  org: "/dashboard",
  donor: "/portal",
  volunteer: "/volunteer",
};

// ---------------- LOGIN ----------------
const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

/**
 * One account across the four principal tables, normalized so the credential
 * check, the lockout bookkeeping and the session claims are written once rather
 * than four subtly-different times.
 */
type Candidate = {
  kind: SessionClaims["kind"];
  id: string;
  passwordHash: string;
  claims: SessionClaims;
  account: { failedLoginCount: number; lockedUntil: Date | null };
  mustChangePassword: boolean;
  needsTwoFactor: boolean;
};

/** Find the single account matching an email, across every principal type. */
async function findCandidate(email: string): Promise<Candidate | null> {
  const platform = await adminDb.platformAdmin.findUnique({ where: { email } });
  if (platform) {
    return {
      kind: "platform",
      id: platform.id,
      passwordHash: platform.passwordHash,
      claims: {
        sub: platform.id,
        kind: "platform",
        role: platform.role,
        name: platform.name,
        email: platform.email,
        v: platform.tokenVersion,
      },
      account: { failedLoginCount: platform.failedLoginCount, lockedUntil: platform.lockedUntil },
      mustChangePassword: platform.mustChangePassword,
      needsTwoFactor: false,
    };
  }

  const orgUser = await adminDb.orgUser.findFirst({ where: { email, status: "active" } });
  if (orgUser) {
    return {
      kind: "org",
      id: orgUser.id,
      passwordHash: orgUser.passwordHash,
      claims: {
        sub: orgUser.id,
        kind: "org",
        role: orgUser.role,
        orgId: orgUser.orgId,
        name: orgUser.name,
        email: orgUser.email,
        v: orgUser.tokenVersion,
      },
      account: { failedLoginCount: orgUser.failedLoginCount, lockedUntil: orgUser.lockedUntil },
      mustChangePassword: orgUser.mustChangePassword,
      needsTwoFactor: !!orgUser.totpEnabledAt,
    };
  }

  const volunteer = await adminDb.volunteer.findFirst({
    where: { email, status: "active", passwordHash: { not: null } },
  });
  if (volunteer?.passwordHash) {
    return {
      kind: "volunteer",
      id: volunteer.id,
      passwordHash: volunteer.passwordHash,
      claims: {
        sub: volunteer.id,
        kind: "volunteer",
        role: "volunteer",
        orgId: volunteer.orgId,
        name: `${volunteer.firstName} ${volunteer.lastName}`,
        email: volunteer.email,
        v: volunteer.tokenVersion,
      },
      account: { failedLoginCount: volunteer.failedLoginCount, lockedUntil: volunteer.lockedUntil },
      mustChangePassword: volunteer.mustChangePassword,
      needsTwoFactor: false,
    };
  }

  const donor = await adminDb.donor.findFirst({ where: { email, passwordHash: { not: null } } });
  if (donor?.passwordHash) {
    return {
      kind: "donor",
      id: donor.id,
      passwordHash: donor.passwordHash,
      claims: {
        sub: donor.id,
        kind: "donor",
        role: "donor",
        orgId: donor.orgId,
        name: `${donor.firstName} ${donor.lastName}`,
        email: donor.email,
        v: donor.tokenVersion,
      },
      account: { failedLoginCount: donor.failedLoginCount, lockedUntil: donor.lockedUntil },
      mustChangePassword: donor.mustChangePassword,
      needsTwoFactor: false,
    };
  }

  return null;
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (!(await rateLimit(`login:${clientIp()}`, 10, 60_000)).ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }
  const { email, password } = parsed.data;

  // Pre-tenant lookups use adminDb (bypasses RLS).
  const candidate = await findCandidate(email);

  // Same message whether the account is unknown or the password is wrong, so the
  // form can't be used to enumerate which emails have accounts.
  const GENERIC = "Incorrect email or password.";
  if (!candidate) return { error: GENERIC };

  if (isLocked(candidate.account)) {
    return {
      error: `Too many failed attempts. This account is locked for ${lockMinutesRemaining(
        candidate.account
      )} more minute(s).`,
    };
  }

  if (!(await verifyPassword(password, candidate.passwordHash))) {
    await registerFailure(candidate.kind, candidate.id, candidate.account);
    return { error: GENERIC };
  }

  await registerSuccess(candidate.kind, candidate.id, candidate.account);

  // 2FA: don't hand out a session yet — issue a short-lived ticket and send them
  // to the second-factor challenge.
  if (candidate.needsTwoFactor) {
    await createTwoFactorTicket(candidate.id);
    redirect("/login/2fa");
  }

  await createSession(candidate.claims);
  // Invited users and admin-reset accounts must pick their own password before
  // they can reach anything else.
  redirect(candidate.mustChangePassword ? "/change-password" : portalFor[candidate.kind]);
}

// ---------------- 2FA CHALLENGE (org users with TOTP) ----------------
export async function verifyTwoFactorAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const userId = await readTwoFactorTicket();
  if (!userId) redirect("/login");

  if (!(await rateLimit(`2fa:${clientIp()}`, 10, 60_000)).ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Enter your authentication code." };

  const user = await adminDb.orgUser.findUnique({ where: { id: userId } });
  if (!user || !user.totpEnabledAt || !user.totpSecret) {
    clearTwoFactorTicket();
    redirect("/login");
  }

  let ok = verifyTotp(user.totpSecret, code);

  // Fall back to a one-time recovery code (consumed on use).
  if (!ok && user.totpRecoveryCodes.length > 0) {
    for (const hash of user.totpRecoveryCodes) {
      if (await verifyPassword(code.toLowerCase().replace(/\s/g, ""), hash)) {
        ok = true;
        await adminDb.orgUser.update({
          where: { id: user.id },
          data: { totpRecoveryCodes: user.totpRecoveryCodes.filter((h) => h !== hash) },
        });
        break;
      }
    }
  }

  if (!ok) return { error: "That code isn't valid. Try again." };

  clearTwoFactorTicket();
  await createSession({
    sub: user.id,
    kind: "org",
    role: user.role,
    orgId: user.orgId,
    name: user.name,
    email: user.email,
    v: user.tokenVersion,
  });
  redirect(user.mustChangePassword ? "/change-password" : "/dashboard");
}

// ---------------- SIGNUP (org) ----------------
const signupSchema = z.object({
  org: z.string().min(2, "Organization name is required"),
  name: z.string().min(2, "Your name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

export async function signupAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  if (!(await rateLimit(`signup:${clientIp()}`, 5, 60_000)).ok) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }
  const parsed = signupSchema.safeParse({
    org: formData.get("org"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { org, name, email, password } = parsed.data;

  const existing = await adminDb.orgUser.findFirst({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists." };
  }

  // unique slug
  let slug = slugify(org) || "org";
  if (await adminDb.organization.findUnique({ where: { slug } })) {
    slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  }

  const passwordHash = await hashPassword(password);
  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const created = await adminDb.organization.create({
    data: {
      name: org,
      slug,
      charityStatus: "non_registered",
      receiptLocality: "Canada",
      users: {
        create: { email, name, role: "org_admin", passwordHash },
      },
      subscription: {
        create: {
          plan: "starter",
          cycle: "monthly",
          priceCad: 29,
          status: "trialing",
          trialEndsAt,
        },
      },
      funds: {
        create: [
          { name: "General Fund", code: "GEN" },
          { name: "Building Fund", code: "BLD" },
        ],
      },
    },
    include: { users: true },
  });

  const user = created.users[0];
  await createSession({
    sub: user.id,
    kind: "org",
    role: user.role,
    orgId: created.id,
    name: user.name,
    email: user.email,
    v: user.tokenVersion,
  });
  redirect("/dashboard/onboarding");
}

// ---------------- FORGOT / RESET PASSWORD ----------------
const forgotSchema = z.object({ email: z.string().email("Enter a valid email") });

/**
 * Always reports success. Telling an anonymous visitor whether an email has an
 * account here would leak the donor and staff roster of every charity on the
 * platform, so the response is identical either way.
 */
export async function requestPasswordReset(
  _prev: AuthState & { sent?: boolean },
  formData: FormData
): Promise<AuthState & { sent?: boolean }> {
  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email } = parsed.data;

  // Tight limit: this endpoint sends mail on behalf of an unauthenticated caller.
  if (!(await rateLimit(`forgot:${clientIp()}`, 5, 15 * 60_000)).ok) {
    return { error: "Too many requests. Please wait a few minutes and try again." };
  }

  const candidate = await findCandidate(email);
  if (candidate) {
    try {
      const { token } = await issueResetToken({
        principal: candidate.kind,
        principalId: candidate.id,
        orgId: candidate.claims.orgId ?? null,
      });
      await sendEmailWithRetry({
        to: email,
        subject: "Reset your KindPath password",
        html: emailLayout({
          heading: "Reset your password",
          body: `We received a request to reset the password for
            <strong>${escapeHtml(email)}</strong>. This link expires in one hour and
            can be used once. If you didn't ask for this, you can ignore this email —
            your password won't change.`,
          cta: { label: "Choose a new password", url: resetUrl(token) },
        }),
      });
      await audit({
        actor: { type: "system" },
        orgId: candidate.claims.orgId ?? null,
        action: "auth.password_reset.requested",
        entityType: candidate.kind,
        entityId: candidate.id,
        ip: clientIp(),
      });
    } catch (e) {
      captureError(e, { source: "auth.requestPasswordReset" });
    }
  }

  return { sent: true };
}

const resetSchema = z
  .object({
    token: z.string().min(10),
    password: z.string().min(10, "Use at least 10 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Those passwords don't match",
    path: ["confirm"],
  });

export async function resetPasswordAction(
  _prev: AuthState & { ok?: boolean },
  formData: FormData
): Promise<AuthState & { ok?: boolean }> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  if (!(await rateLimit(`reset:${clientIp()}`, 10, 15 * 60_000)).ok) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const result = await consumeResetToken(parsed.data.token, parsed.data.password);
  if (!result.ok) {
    return {
      error:
        result.reason === "expired"
          ? "That link has expired. Request a new one."
          : result.reason === "used"
            ? "That link has already been used. Request a new one."
            : "That reset link isn't valid. Request a new one.",
    };
  }

  await audit({
    actor: { type: "system" },
    orgId: result.orgId,
    action: "auth.password_reset.completed",
    entityType: result.principal,
    entityId: result.principalId,
    ip: clientIp(),
  });

  // Deliberately do NOT sign them in — they prove the new password at /login.
  return { ok: true };
}

// ---------------- FORCED PASSWORD CHANGE (invited / admin-reset accounts) ----------------
const changeSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    password: z.string().min(10, "Use at least 10 characters"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Those passwords don't match",
    path: ["confirm"],
  })
  .refine((d) => d.password !== d.current, {
    message: "Choose a password different from your current one",
    path: ["password"],
  });

export async function changePasswordAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const session = await getSession();
  if (!session) redirect("/login");

  // Session-gated, but it verifies the CURRENT password — without a limit that
  // is an unmetered password-confirmation oracle for anyone holding a stolen
  // session cookie.
  if (!(await rateLimit(`change-pw:${session.sub}`, 5, 15 * 60_000)).ok) {
    return { error: "Too many attempts. Please wait a few minutes and try again." };
  }

  const parsed = changeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const candidate = await findCandidate(session.email);
  if (!candidate || candidate.id !== session.sub) redirect("/login");
  if (!(await verifyPassword(parsed.data.current, candidate.passwordHash))) {
    return { error: "That current password isn't right." };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const data = { passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null };
  switch (session.kind) {
    case "platform":
      await adminDb.platformAdmin.update({ where: { id: session.sub }, data });
      break;
    case "org":
      await adminDb.orgUser.update({ where: { id: session.sub }, data });
      break;
    case "volunteer":
      await adminDb.volunteer.update({ where: { id: session.sub }, data });
      break;
    case "donor":
      await adminDb.donor.update({ where: { id: session.sub }, data });
      break;
  }

  // Every other device holding this account's session is now stale...
  await revokeSessions(session.kind, session.sub);
  await audit({
    actor: { type: session.kind === "platform" ? "platform_admin" : "org_user", id: session.sub },
    orgId: session.orgId ?? null,
    action: "auth.password_changed",
    entityType: session.kind,
    entityId: session.sub,
    ip: clientIp(),
  });

  // ...including this one, so re-issue it at the new version.
  await createSession({ ...session, v: (session.v ?? 0) + 1 });
  redirect(portalFor[session.kind]);
}

// ---------------- LOGOUT ----------------
export async function logoutAction() {
  destroySession();
  redirect("/login");
}
