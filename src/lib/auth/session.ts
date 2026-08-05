import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import {
  signSession,
  verifySession,
  SESSION_MAX_AGE,
  type SessionClaims,
} from "./jwt";
import { checkSession, type RevocationReason } from "./revocation";

const COOKIE = process.env.AUTH_COOKIE ?? "kindpath_session";

export async function createSession(claims: SessionClaims) {
  const token = await signSession(claims);
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Resolve the current session: verify the signature, THEN confirm the principal
 * is still entitled to it (see revocation.ts). A valid signature alone is not
 * enough — these tokens live for 7 days.
 *
 * Wrapped in React `cache` so the revocation lookup runs once per request even
 * when several guards and layouts ask for the session.
 */
export const getSession = cache(async (): Promise<SessionClaims | null> => {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const claims = await verifySession(token);
  if (!claims) return null;
  return (await checkSession(claims)) === "ok" ? claims : null;
});

/**
 * Same as getSession but reports *why* a session was rejected, so the UI can say
 * "your organization has been suspended" instead of dumping the user at /login
 * with no explanation.
 */
export const getSessionStatus = cache(
  async (): Promise<{ claims: SessionClaims | null; reason: RevocationReason | "no_token" }> => {
    const token = cookies().get(COOKIE)?.value;
    if (!token) return { claims: null, reason: "no_token" };
    const claims = await verifySession(token);
    if (!claims) return { claims: null, reason: "no_token" };
    const reason = await checkSession(claims);
    return { claims: reason === "ok" ? claims : null, reason };
  }
);

export function destroySession() {
  cookies().delete(COOKIE);
}
