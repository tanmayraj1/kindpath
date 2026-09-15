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
 * WeVend supports two auth shapes, and which one an org uses decides what has to
 * be stored here at all:
 *   - **Organization Global Token** (WeVend's documented default for this
 *     integration): the PLATFORM authenticates once as the organization and
 *     addresses each merchant by passing `mid` per call. An org then stores only
 *     `mid` + `termId` — no password ever leaves the charity, which is the whole
 *     point of the model.
 *   - **Merchant mode**: `email` + `password` for a merchant that is not under
 *     the platform's organization (POST /auth/token with mid + email + password).
 * `mid` identifies the merchant to transact as in both modes.
 */
export type WeVendCredentials = {
  provider: "wevend";
  mid: string;
  termId: string;
  /** Merchant mode only. Absent means "address this merchant with the platform's organization token". */
  password?: string;
  email?: string;
  wvNumber?: string;
};

/**
 * Each charity connects its OWN Stripe account, so donations settle directly to
 * the charity — KindPath never becomes an intermediary holding donor funds, which
 * would be a money-transmission posture nobody here wants.
 */
export type StripeCredentials = {
  provider: "stripe";
  secretKey: string;
  webhookSecret?: string;
};

export type OrgGatewayCredentials = WeVendCredentials | StripeCredentials;

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

/** Validate the decrypted shape. Returns null when unusable — never a partial. */
export function parseCredentials(plain: string): OrgGatewayCredentials | null {
  try {
    const parsed = JSON.parse(plain) as Partial<OrgGatewayCredentials>;

    if (parsed.provider === "stripe") {
      const c = parsed as Partial<StripeCredentials>;
      if (!c.secretKey) return null;
      // A publishable key here would mean the org pasted the wrong one; charging
      // would fail later with an opaque Stripe error instead of failing now.
      if (!/^sk_(test|live)_/.test(c.secretKey)) return null;
      return { provider: "stripe", secretKey: c.secretKey, webhookSecret: c.webhookSecret };
    }

    if (parsed.provider === "wevend") {
      const c = parsed as Partial<WeVendCredentials>;
      if (!c.mid || !c.termId) return null;
      // No password: the merchant is addressed under the PLATFORM's organization
      // token, which is exactly what connectWeVendAccount stores when the
      // platform holds one. This used to require a password, so every charity
      // connected that way read back as "unreadable" and had donations refused.
      if (!c.password) {
        if (c.email || c.wvNumber) return null; // a login with no password is half a credential
        return { provider: "wevend", mid: c.mid, termId: c.termId };
      }
      // Own login: exactly one auth mode must be identifiable.
      if (!c.email && !c.wvNumber) return null;
      return {
        provider: "wevend",
        mid: c.mid,
        termId: c.termId,
        password: c.password,
        email: c.email,
        wvNumber: c.wvNumber,
      };
    }

    return null;
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
  provider?: "wevend" | "stripe";
  error?: string;
  midTail?: string;
  email?: string;
  wvNumber?: string;
  termId?: string;
  keyTail?: string;
  liveMode?: boolean;
}> {
  const load = await loadOrgGatewayCredentials(orgId);
  if (load.status === "none") return { configured: false };
  if (load.status === "unreadable") return { configured: true, error: load.reason };

  const { creds } = load;
  if (creds.provider === "stripe") {
    return {
      configured: true,
      provider: "stripe",
      // Never the whole key — just enough to tell two accounts apart.
      keyTail: creds.secretKey.slice(-4),
      liveMode: creds.secretKey.startsWith("sk_live_"),
    };
  }
  return {
    configured: true,
    provider: "wevend",
    midTail: creds.mid.slice(-4),
    email: creds.email,
    wvNumber: creds.wvNumber,
    termId: creds.termId,
  };
}
