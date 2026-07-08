import { adminDb } from "@/lib/db";
import { seal, open } from "@/lib/crypto-box";

/**
 * Per-org gateway merchant credentials, encrypted at rest.
 * The sealed AES-GCM blob lives in Organization.posCredentialsRef — the DB
 * (and any backup/dump of it) never sees plaintext merchant passwords.
 * Gateway base/iframe URLs stay global env config; only merchant identity
 * varies per org.
 */
export type OrgGatewayCredentials = {
  provider: "wevend";
  mid: string;
  email: string;
  password: string;
  termId: string;
};

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

/** Decrypt an org's credentials; null when unset, undecryptable, or malformed. */
export async function loadOrgGatewayCredentials(
  orgId: string
): Promise<OrgGatewayCredentials | null> {
  const org = await adminDb.organization.findUnique({
    where: { id: orgId },
    select: { posCredentialsRef: true },
  });
  const plain = open(org?.posCredentialsRef);
  if (!plain) return null;
  try {
    const parsed = JSON.parse(plain) as OrgGatewayCredentials;
    if (parsed.provider !== "wevend" || !parsed.mid || !parsed.email || !parsed.password) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Non-secret summary for admin UI ("configured, mid ending 1600"). */
export async function describeOrgGatewayCredentials(
  orgId: string
): Promise<{ configured: boolean; midTail?: string; email?: string; termId?: string }> {
  const creds = await loadOrgGatewayCredentials(orgId);
  if (!creds) return { configured: false };
  return { configured: true, midTail: creds.mid.slice(-4), email: creds.email, termId: creds.termId };
}
