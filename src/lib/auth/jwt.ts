import { SignJWT, jwtVerify } from "jose";

/**
 * Session token claims. `kind` distinguishes the three principal types so a
 * single cookie can authenticate platform admins, org users, and donors.
 */
export type SessionClaims = {
  sub: string; // user id
  kind: "platform" | "org" | "donor" | "volunteer";
  role: string; // e.g. super_admin | org_admin | donor | volunteer
  orgId?: string; // present for org users, donors and volunteers
  name: string;
  email: string;
  /**
   * Token version. Compared against the principal's stored `tokenVersion` on
   * every request (src/lib/auth/revocation.ts); a mismatch means the session was
   * revoked — password reset, account disabled, org suspended. Without it these
   * 7-day tokens would stay valid long after access was withdrawn.
   * Optional so sessions issued before this shipped simply read as version 0.
   */
  v?: number;
};

const ALG = "HS256";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    return payload as unknown as SessionClaims;
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
