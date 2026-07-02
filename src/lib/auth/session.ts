import "server-only";
import { cookies } from "next/headers";
import {
  signSession,
  verifySession,
  SESSION_MAX_AGE,
  type SessionClaims,
} from "./jwt";

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

export async function getSession(): Promise<SessionClaims | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function destroySession() {
  cookies().delete(COOKIE);
}
