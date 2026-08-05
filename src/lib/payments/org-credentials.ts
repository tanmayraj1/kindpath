import { adminDb } from "@/lib/db";
import { seal, open } from "@/lib/crypto-box";
import { captureError } from "@/lib/observability";

/**
 * Per-org gateway merchant credentials, encrypted at rest.
 * The sealed AES-GCM blob lives in Organization.posCredentialsRef — the DB
 * (and any backup/dump of it) never sees plaintext merchant passwords.
 * Gateway base/iframe URLs stay global env config; only merchant identity
 * varies per org.
 *
 * WeVend supports two auth shapes, so credentials carry either:
 *   - `email`    → merchant mode  (POST /auth/token with mid + email + password)
 *   - `wvNumber` → org/ISV mode   (POST /auth/org-token with wvNumber + password)
 * `mid` identifies the merchant to transact as in both modes.
 */
export type OrgGatewayCredentials = {
  provider: "wevend";
  mid: string;
  termId: string;
  password: string;
  email?: string;
  wvNumber?: string;
};

/**
 * Loading credentials has THREE outcomes, and conflating them misroutes money.
 * "none" means this org never configured its own merchant, so the env-level
 * merchant is the intended fallback. "unreadable" means credentials WERE stored
 * but can't be decrypted (wrong CREDENTIALS_KEY, corrupted blob) — falling back
 * there would deposit this charity's donations into a different merchant account.
 */
export type CredentialLoad =
  | { status: "none" }
  | { status: "ok"; creds: OrgGatewayCredentials }
  | { status: "unreadable"; reason: string };

export async function saveOrgGatewayCredentials(
  orgId: string,
  creds: OrgGatewayCredentials
): Promise<void> {
  await adminDb.organization.update({
    where: { id: orgId },
    data: { posCredentialsRef: seal(JSON.stringify(creds)) },
  });
}

export async function clearOrgGatewayCredentials(orgId: string): Promise<void> {
  await adminDb.organization.update({
    where: { id: orgId },
    data: { posCredentialsRef: null },
  });
}

/** Validate the decrypted shape. Returns null with a reason when unusable. */
export function parseCredentials(plain: string): OrgGatewayCredentials | null {
  try {
    const parsed = JSON.parse(plain) as OrgGatewayCredentials;
    if (parsed.provider !== "wevend") return null;
    if (!parsed.mid || !parsed.password || !parsed.termId) return null;
    // Exactly one auth mode must be identifiable.
    if (!parsed.email && !parsed.wvNumber) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function loadOrgGatewayCredentials(orgId: string): Promise<CredentialLoad> {
  const org = await adminDb.organization.findUnique({
    where: { id: orgId },
    select: { posCredentialsRef: true },
  });
  if (!org?.posCredentialsRef) return { status: "none" };

  const plain = open(org.posCredentialsRef);
  if (!plain) {
    const reason = "stored gateway credentials could not be decrypted (CREDENTIALS_KEY changed?)";
    captureError(new Error(reason), { source: "payments.loadOrgGatewayCredentials", orgId });
    return { status: "unreadable", reason };
  }

  const creds = parseCredentials(plain);
  if (!creds) {
    const reason = "stored gateway credentials decrypted but are malformed";
    captureError(new Error(reason), { source: "payments.loadOrgGatewayCredentials", orgId });
    return { status: "unreadable", reason };
  }
  return { status: "ok", creds };
}

/** Non-secret summary for admin UI ("configured, mid ending 1600"). */
export async function describeOrgGatewayCredentials(orgId: string): Promise<{
  configured: boolean;
  error?: string;
  midTail?: string;
  email?: string;
  wvNumber?: string;
  termId?: string;
}> {
  const load = await loadOrgGatewayCredentials(orgId);
  if (load.status === "none") return { configured: false };
  if (load.status === "unreadable") return { configured: true, error: load.reason };
  const { creds } = load;
  return {
    configured: true,
    midTail: creds.mid.slice(-4),
    email: creds.email,
    wvNumber: creds.wvNumber,
    termId: creds.termId,
  };
}
