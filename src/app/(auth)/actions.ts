"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { adminDb } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroySession } from "@/lib/auth/session";
import type { SessionClaims } from "@/lib/auth/jwt";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { verifyTotp } from "@/lib/auth/totp";
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

  let claims: SessionClaims | null = null;

  // Pre-tenant lookups use adminDb (bypasses RLS). Check each principal type.
  const platform = await adminDb.platformAdmin.findUnique({ where: { email } });
  if (platform && (await verifyPassword(password, platform.passwordHash))) {
    claims = {
      sub: platform.id,
      kind: "platform",
      role: platform.role,
      name: platform.name,
      email: platform.email,
    };
  }

  if (!claims) {
    const orgUser = await adminDb.orgUser.findFirst({ where: { email } });
    if (
      orgUser &&
      orgUser.status === "active" &&
      (await verifyPassword(password, orgUser.passwordHash))
    ) {
      // If this org user has 2FA enabled, don't hand out a session yet — issue a
      // short-lived ticket and send them to the second-factor challenge.
      if (orgUser.totpEnabledAt) {
        await createTwoFactorTicket(orgUser.id);
        redirect("/login/2fa");
      }
      claims = {
        sub: orgUser.id,
        kind: "org",
        role: orgUser.role,
        orgId: orgUser.orgId,
        name: orgUser.name,
        email: orgUser.email,
      };
    }
  }

  if (!claims) {
    const volunteer = await adminDb.volunteer.findFirst({
      where: { email, status: "active", passwordHash: { not: null } },
    });
    if (
      volunteer?.passwordHash &&
      (await verifyPassword(password, volunteer.passwordHash))
    ) {
      claims = {
        sub: volunteer.id,
        kind: "volunteer",
        role: "volunteer",
        orgId: volunteer.orgId,
        name: `${volunteer.firstName} ${volunteer.lastName}`,
        email: volunteer.email,
      };
    }
  }

  if (!claims) {
    const donor = await adminDb.donor.findFirst({
      where: { email, passwordHash: { not: null } },
    });
    if (donor?.passwordHash && (await verifyPassword(password, donor.passwordHash))) {
      claims = {
        sub: donor.id,
        kind: "donor",
        role: "donor",
        orgId: donor.orgId,
        name: `${donor.firstName} ${donor.lastName}`,
        email: donor.email,
      };
    }
  }

  if (!claims) {
    return { error: "Incorrect email or password." };
  }

  await createSession(claims);
  redirect(portalFor[claims.kind]);
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
  });
  redirect("/dashboard");
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
  });
  redirect("/dashboard/onboarding");
}

// ---------------- LOGOUT ----------------
export async function logoutAction() {
  destroySession();
  redirect("/login");
}
