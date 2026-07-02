"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { requireOrgUser } from "@/lib/auth/guards";
import { withTenant } from "@/lib/tenant";
import { getOrg } from "@/lib/queries/org";
import { hashPassword } from "@/lib/auth/password";
import {
  generateTotpSecret,
  otpauthUrl,
  verifyTotp,
  generateRecoveryCodes,
} from "@/lib/auth/totp";

export type SetupState = {
  error?: string;
  secret?: string;
  otpauth?: string;
  qr?: string;
};

/**
 * Step 1 of enabling 2FA: generate + persist a pending secret (enabledAt stays
 * null until a code is verified) and return the QR to scan.
 */
export async function beginTwoFactorSetup(): Promise<SetupState> {
  const session = await requireOrgUser();
  const org = await getOrg(session.orgId);
  const secret = generateTotpSecret();

  await withTenant(session.orgId, (tx) =>
    tx.orgUser.update({
      where: { id: session.sub },
      data: { totpSecret: secret, totpEnabledAt: null, totpRecoveryCodes: [] },
    })
  );

  const uri = otpauthUrl({
    secret,
    account: session.email,
    issuer: `KindPath — ${org?.name ?? "KindPath"}`,
  });
  const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
  return { secret, otpauth: uri, qr };
}

export type ActivateState = { error?: string; ok?: boolean; recoveryCodes?: string[] };

/** Step 2: verify a code against the pending secret, then turn 2FA on. */
export async function activateTwoFactor(
  _prev: ActivateState,
  formData: FormData
): Promise<ActivateState> {
  const session = await requireOrgUser();
  const code = String(formData.get("code") ?? "").trim();

  const user = await withTenant(session.orgId, (tx) =>
    tx.orgUser.findUnique({ where: { id: session.sub } })
  );
  if (!user?.totpSecret) {
    return { error: "Start the setup again — no pending secret was found." };
  }
  if (user.totpEnabledAt) {
    return { error: "Two-factor authentication is already enabled." };
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return { error: "That code isn't valid. Make sure your device clock is correct and try again." };
  }

  const recoveryCodes = generateRecoveryCodes(10);
  const hashed = await Promise.all(recoveryCodes.map((c) => hashPassword(c)));

  await withTenant(session.orgId, (tx) =>
    tx.orgUser.update({
      where: { id: session.sub },
      data: { totpEnabledAt: new Date(), totpRecoveryCodes: hashed },
    })
  );
  revalidatePath("/dashboard/security");
  return { ok: true, recoveryCodes };
}

export type DisableState = { error?: string; ok?: boolean };

/** Turn 2FA off — requires a current code so a hijacked open tab can't do it silently. */
export async function disableTwoFactor(
  _prev: DisableState,
  formData: FormData
): Promise<DisableState> {
  const session = await requireOrgUser();
  const code = String(formData.get("code") ?? "").trim();

  const user = await withTenant(session.orgId, (tx) =>
    tx.orgUser.findUnique({ where: { id: session.sub } })
  );
  if (!user?.totpEnabledAt || !user.totpSecret) {
    return { error: "Two-factor authentication isn't enabled." };
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return { error: "Enter a valid current code to disable two-factor authentication." };
  }

  await withTenant(session.orgId, (tx) =>
    tx.orgUser.update({
      where: { id: session.sub },
      data: { totpSecret: null, totpEnabledAt: null, totpRecoveryCodes: [] },
    })
  );
  revalidatePath("/dashboard/security");
  return { ok: true };
}
