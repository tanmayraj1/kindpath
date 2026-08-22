"use server";

import { randomBytes } from "node:crypto";
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
import { issueLoginCode, consumeLoginCode, normalizeEmail } from "@/lib/auth/login-code";
import { findCandidates, withPassword, type Candidate } from "@/lib/auth/candidates";
import { safeNext } from "@/lib/auth/portals";
import {
  createAccountTicket,
  readAccountTicket,
  clearAccountTicket,
} from "@/lib/auth/account-ticket";
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
 * A dummy hash to verify against when an email matches nothing.
 *
 * Without it, an unknown address returns before any bcrypt work happens while a
 * known one pays for a verification — a timing signal that answers "does this
 * email have an account here?" for an anonymous caller. Generated once at module
 * load from a value nobody holds.
 */
const DUMMY_HASH_PROMISE = hashPassword(randomBytes(24).toString("base64url"));

/** Same message whether the account is unknown or the password is wrong. */
const GENERIC = "Incorrect email or password.";

/**
 * Finish signing a candidate in: second factor, forced password change, or a
 * session. Shared by the direct path and the account chooser so the three checks
 * can never drift apart between them.
 */
async function completeLogin(candidate: Candidate, next: string | null): Promise<never> {
  if (candidate.needsTwoFactor) {
    await createTwoFactorTicket(candidate.id);
    redirect(next ? `/login/2fa?next=${encodeURIComponent(next)}` : "/login/2fa");
  }
  await createSession(candidate.claims);
  // Invited users and admin-reset accounts must pick their own password first.
  if (candidate.mustChangePassword) {
    redirect(next ? `/change-password?next=${encodeURIComponent(next)}` : "/change-password");
  }
  redirect(safeNext(next, candidate.kind));
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
  const next = typeof formData.get("next") === "string" ? String(formData.get("next")) : null;

  // Pre-tenant lookups use adminDb (bypasses RLS).
  // An email can legitimately match several accounts — donors, volunteers and
  // org users are unique per organization, not globally.
  const all = await findCandidates(email);
  const candidates = withPassword(all);

  if (candidates.length === 0) {
    // Equalise timing against the case where an account exists (see DUMMY_HASH).
    await verifyPassword(password, await DUMMY_HASH_PROMISE);
    return { error: GENERIC };
  }

  const unlocked = candidates.filter((c) => !isLocked(c.account));
  if (unlocked.length === 0) {
    const soonest = candidates.reduce((a, b) =>
      lockMinutesRemaining(a.account) <= lockMinutesRemaining(b.account) ? a : b
    );
    return {
      error: `Too many failed attempts. This account is locked for ${lockMinutesRemaining(
        soonest.account
      )} more minute(s).`,
    };
  }

  const verified: typeof unlocked = [];
  for (const c of unlocked) {
    if (await verifyPassword(password, c.passwordHash)) verified.push(c);
  }

  if (verified.length === 0) {
    // Count the failure against EVERY unlocked sibling. Charging only the first
    // would let an attacker spread guesses across an address's other accounts
    // and never trip a lockout on any of them.
    await Promise.all(unlocked.map((c) => registerFailure(c.kind, c.id, c.account)));
    return { error: GENERIC };
  }

  await Promise.all(verified.map((c) => registerSuccess(c.kind, c.id, c.account)));

  if (verified.length === 1) {
    await completeLogin(verified[0], next);
  }

  // More than one account shares this password. Ask which one — safe now, and
  // only now, because the password has already been proven against each of them.
  await createAccountTicket(
    verified.map((c) => ({ kind: c.kind, id: c.id })),
    next
  );
  redirect("/login/choose");
}

// ---------------- PASSWORDLESS SIGN-IN (EMAIL CODE) ----------------

/**
 * Which principals may sign in with an emailed code.
 *
 * Donors and volunteers only, and that is a security boundary rather than a
 * product choice: a code is exactly as strong as the recipient's inbox, and an
 * org admin can void official tax receipts, cancel a donor's recurring gift and
 * mass-email every donor on file. Those accounts keep password + TOTP.
 *
 * A code never REPLACES a password. An existing donor password keeps working —
 * this is a second door, and removing the first would strand anyone mid-flow.
 */
const CODE_ELIGIBLE: SessionClaims["kind"][] = ["donor", "volunteer"];

const codeRequestSchema = z.object({ email: z.string().email("Enter a valid email") });

/** Said whatever happens, so the response can't be used to test whether an address is on file. */
const CODE_SENT = "If that address is on file, a sign-in code is on its way.";

export type CodeState = { error?: string; sent?: boolean };

export async function requestLoginCodeAction(
  _prev: CodeState,
  formData: FormData
): Promise<CodeState> {
  const parsed = codeRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const email = normalizeEmail(parsed.data.email);

  // Two limits, and they guard different things. Per-IP stops one host walking a
  // list of addresses; per-email stops a botnet mail-bombing one donor's inbox,
  // which the IP limit cannot see. Both fail open (see rate-limit.ts) — the real
  // brute-force ceiling is attemptCount on the row.
  if (!(await rateLimit(`login-code:ip:${clientIp()}`, 10, 60_000)).ok) {
    return { error: "Too many requests. Please wait a minute." };
  }
  if (!(await rateLimit(`login-code:email:${email}`, 5, 15 * 60_000)).ok) {
    return { sent: true };
  }

  const candidates = (await findCandidates(email)).filter((c) => CODE_ELIGIBLE.includes(c.kind));

  // No eligible account: return the same message, having done the same work. An
  // org admin's address lands here too, so the response cannot be used to sort
  // staff addresses from donor ones.
  if (candidates.length === 0) return { sent: true };

  const { code } = await issueLoginCode(email);

  const result = await sendEmailWithRetry({
    to: email,
    subject: `${code} is your KindPath sign-in code`,
    html: emailLayout({
      heading: "Your sign-in code",
      body: `<p>Enter this code to sign in. It expires in 10 minutes.</p>
             <p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:24px 0">${escapeHtml(code)}</p>
             <p>If you didn't ask for this, you can ignore this email — nothing has changed on your account.</p>`,
    }),
  });
  if (!result.ok) {
    captureError(new Error(result.error), { source: "auth.requestLoginCode" });
    return { error: "We couldn't send the code just now. Please try again shortly." };
  }

  return { sent: true };
}

const codeVerifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(1, "Enter the 6-digit code"),
});

export async function verifyLoginCodeAction(
  _prev: CodeState,
  formData: FormData
): Promise<CodeState> {
  const next = typeof formData.get("next") === "string" ? String(formData.get("next")) : null;
  const parsed = codeVerifySchema.safeParse({
    email: formData.get("email"),
    code: formData.get("code"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const email = normalizeEmail(parsed.data.email);

  if (!(await rateLimit(`login-code-verify:${clientIp()}`, 20, 60_000)).ok) {
    return { error: "Too many attempts. Please wait a minute." };
  }

  const outcome = await consumeLoginCode(email, parsed.data.code);
  if (!outcome.ok) {
    if (outcome.reason === "expired") {
      return { error: "That code has expired. Request a new one." };
    }
    if (outcome.reason === "too_many_attempts") {
      return { error: "Too many incorrect attempts. Request a new code." };
    }
    return { error: "That code isn't right. Check it and try again." };
  }

  // Re-resolve AFTER the code verifies rather than trusting anything carried
  // through the form, so an erasure or a disable between the two steps still
  // takes effect — the same reason chooseAccountAction re-reads the account.
  const candidates = (await findCandidates(email)).filter((c) => CODE_ELIGIBLE.includes(c.kind));
  if (candidates.length === 0) {
    return { error: "That account is no longer available." };
  }

  await Promise.all(candidates.map((c) => registerSuccess(c.kind, c.id, c.account)));

  if (candidates.length === 1) {
    await completeLogin(candidates[0], next);
  }

  // Same address at more than one organization. The chooser is safe here for the
  // same reason it is on the password path: possession of the inbox has already
  // been proven against every one of these rows.
  await createAccountTicket(
    candidates.map((c) => ({ kind: c.kind, id: c.id })),
    next
  );
  redirect("/login/choose");
}

/**
 * Exchange an account-chooser ticket for a session.
 *
 * The chosen id must appear in the ticket, which was written only after the
 * password verified against those exact rows. That membership check is the whole
 * security of this endpoint.
 */
export async function chooseAccountAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const ticket = await readAccountTicket();
  if (!ticket) redirect("/login");

  // The submitter's own value: "<kind>:<id>". Only the clicked button is posted.
  const [kind = "", id = ""] = String(formData.get("account") ?? "").split(":");
  if (!ticket.accounts.some((a) => a.kind === kind && a.id === id)) {
    clearAccountTicket();
    redirect("/login");
  }

  // Re-read the account rather than trusting anything carried in the cookie, so
  // a disable or erasure between the two steps still takes effect.
  const candidate = (await findCandidates(String(formData.get("email") ?? ""))).find(
    (c) => c.kind === kind && c.id === id
  );
  if (!candidate) {
    clearAccountTicket();
    return { error: "That account is no longer available. Please sign in again." };
  }

  clearAccountTicket();
  // Always redirects; the return keeps the signature honest for the type system.
  return completeLogin(candidate, ticket.next);
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
  const next = typeof formData.get("next") === "string" ? String(formData.get("next")) : null;
  redirect(
    user.mustChangePassword
      ? next
        ? `/change-password?next=${encodeURIComponent(next)}`
        : "/change-password"
      : safeNext(next, "org")
  );
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

  // Prove the mailbox. Deliberately does NOT gate anything yet — receipts,
  // billing notices and password resets all depend on this address being real,
  // so it is worth recording from day one, but refusing access to accounts
  // created before verification existed would lock out real customers.
  // Failure is swallowed inside sendEmailVerification: losing a confirmation
  // email is recoverable, losing the signup is not.
  const { sendEmailVerification } = await import("@/lib/auth/email-verification");
  await sendEmailVerification({
    userId: user.id,
    orgId: created.id,
    email: user.email,
    name: user.name,
    orgName: created.name,
    brandColor: created.primaryColor,
    logoUrl: created.logoUrl,
  });

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

  // Per-address limit on top of the per-IP one. Without it a botnet can point
  // thousands of IPs at one donor and mail-bomb them with reset links.
  if (!(await rateLimit(`forgot:email:${email.toLowerCase()}`, 3, 60 * 60_000)).ok) {
    return { sent: true };
  }

  // EVERY account on this address, including donors who have never set a
  // password. That inclusion is the whole fix: a donor who has given but has no
  // password was previously filtered out here, so the one route that could have
  // bootstrapped their portal access silently did nothing.
  const candidates = await findCandidates(email);

  if (candidates.length > 0) {
    try {
      const links: { label: string; url: string }[] = [];

      for (const c of candidates) {
        // No password yet means this is a first-time setup, not a reset, so it
        // gets the invite TTL — a donor reading their mail at the weekend needs
        // more than an hour.
        const purpose = c.passwordHash ? "reset" : "invite";
        const { token } = await issueResetToken({
          principal: c.kind,
          principalId: c.id,
          orgId: c.claims.orgId ?? null,
          purpose,
        });
        links.push({
          label: c.orgName
            ? `${c.passwordHash ? "Reset password" : "Set up access"} · ${c.orgName}`
            : c.passwordHash
              ? "Choose a new password"
              : "Set up access",
          url: resetUrl(token),
        });
        await audit({
          actor: { type: "system" },
          orgId: c.claims.orgId ?? null,
          action: purpose === "invite" ? "auth.portal_setup.requested" : "auth.password_reset.requested",
          entityType: c.kind,
          entityId: c.id,
          ip: clientIp(),
        });
      }

      const many = links.length > 1;
      await sendEmailWithRetry({
        to: email,
        subject: many ? "Your KindPath accounts" : "Set your KindPath password",
        html: emailLayout({
          heading: many ? "Choose an account" : "Set your password",
          body: many
            ? `This email address is used by <strong>${links.length}</strong> accounts.
               Pick the one you want to set a password for. Each link works once.
               If you didn't ask for this, you can ignore this email — nothing changes.`
            : `We received a request for <strong>${escapeHtml(email)}</strong>.
               Use the link below to set your password. It works once.
               If you didn't ask for this, you can ignore this email — nothing changes.`,
          ctas: links,
        }),
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
            : result.reason === "revoked"
              ? // The account was erased or switched off after the link was sent.
                // Say so plainly rather than sending them round for another link
                // that will fail the same way.
                "This account is no longer active, so the link can't be used. Please contact the organization."
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

/**
 * The stored hash for the signed-in principal, looked up by id.
 *
 * Kept separate from `findCandidates` on purpose: that resolves an EMAIL, which
 * is ambiguous. Once there is a session there is no ambiguity, so identity comes
 * from the session claims.
 */
async function currentPasswordHash(
  kind: SessionClaims["kind"],
  id: string
): Promise<string | null> {
  switch (kind) {
    case "platform":
      return (await adminDb.platformAdmin.findUnique({ where: { id } }))?.passwordHash ?? null;
    case "org":
      return (await adminDb.orgUser.findUnique({ where: { id } }))?.passwordHash ?? null;
    case "volunteer":
      return (await adminDb.volunteer.findUnique({ where: { id } }))?.passwordHash ?? null;
    case "donor":
      return (await adminDb.donor.findUnique({ where: { id } }))?.passwordHash ?? null;
    default:
      return null;
  }
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

  // Resolve by the session's own identity, never by email. Because an address
  // can belong to several accounts, `findCandidate(session.email)` could return a
  // sibling row, fail the id check, and bounce a legitimately signed-in user to
  // /login — permanently unable to change their password.
  const currentHash = await currentPasswordHash(session.kind, session.sub);
  if (!currentHash) redirect("/login");
  if (!(await verifyPassword(parsed.data.current, currentHash))) {
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
