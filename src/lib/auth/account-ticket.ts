import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { PrincipalKind } from "./portals";

/**
 * Short-lived "which account?" ticket.
 *
 * Issued when one email and password authenticate against MORE THAN ONE account
 * — which is legitimate here, because donors, volunteers and org users are all
 * unique per organization rather than globally. Exchanged for a real session at
 * /login/choose once the person says which one they meant.
 *
 * Like the 2FA ticket this is NOT a session: it authorizes exactly one step and
 * reaches no guarded route. The security property that matters is that the
 * ticket ENUMERATES the accounts the password already matched, and
 * `chooseAccountAction` refuses any id outside that list. Without that check the
 * chooser would be a "sign in as anyone" endpoint.
 *
 * It is also why the chooser runs after the password rather than before: asking
 * "which organization?" up front would tell an anonymous visitor which charities
 * an email address belongs to.
 */
const COOKIE = "kindpath_choose";
const TICKET_TTL_SECONDS = 5 * 60;
const ALG = "HS256";

export type TicketEntry = { kind: PrincipalKind; id: string };

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function createAccountTicket(entries: TicketEntry[], next: string | null) {
  const token = await new SignJWT({ accounts: entries, next: next ?? null, choose: true })
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

export async function readAccountTicket(): Promise<{
  accounts: TicketEntry[];
  next: string | null;
} | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: [ALG] });
    if (payload.choose !== true || !Array.isArray(payload.accounts)) return null;
    const accounts = (payload.accounts as TicketEntry[]).filter(
      (a) => a && typeof a.id === "string" && typeof a.kind === "string"
    );
    if (accounts.length === 0) return null;
    return { accounts, next: typeof payload.next === "string" ? payload.next : null };
  } catch {
    return null;
  }
}

export function clearAccountTicket() {
  cookies().delete(COOKIE);
}
