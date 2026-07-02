import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

/**
 * Short-lived "2FA pending" ticket. Issued after a correct password when the org
 * user has TOTP enabled; exchanged for a full session once the second factor is
 * verified at /login/2fa. It is NOT a session — it only authorizes the 2FA step,
 * so a half-authenticated user cannot reach any guarded route.
 */
const COOKIE = "kindpath_2fa";
const TICKET_TTL_SECONDS = 5 * 60;
const ALG = "HS256";

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createTwoFactorTicket(userId: string) {
  const token = await new SignJWT({ uid: userId, twofa: true })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${TICKET_TTL_SECONDS}s`)
    .sign(secret());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TICKET_TTL_SECONDS,
  });
}

/** Returns the pending user id if a valid ticket is present, else null. */
export async function readTwoFactorTicket(): Promise<string | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (payload.twofa === true && typeof payload.uid === "string") return payload.uid;
    return null;
  } catch {
    return null;
  }
}

export function clearTwoFactorTicket() {
  cookies().delete(COOKIE);
}
