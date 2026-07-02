import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { SessionClaims } from "./jwt";

/** Require any authenticated principal, else send to login. */
export async function requireSession(): Promise<SessionClaims> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Require an org user (org admin portal). Returns the session with orgId. */
export async function requireOrgUser(): Promise<SessionClaims & { orgId: string }> {
  const session = await requireSession();
  if (session.kind !== "org" || !session.orgId) redirect("/login");
  return session as SessionClaims & { orgId: string };
}

/** Require an org user with the org_admin role (manages team, settings). */
export async function requireOrgAdmin(): Promise<SessionClaims & { orgId: string }> {
  const session = await requireOrgUser();
  if (session.role !== "org_admin") redirect("/dashboard");
  return session;
}

/** Require a platform super admin / support. */
export async function requirePlatformAdmin(): Promise<SessionClaims> {
  const session = await requireSession();
  if (session.kind !== "platform") redirect("/login");
  return session;
}

/** Require a volunteer (volunteer portal). */
export async function requireVolunteer(): Promise<SessionClaims & { orgId: string }> {
  const session = await requireSession();
  if (session.kind !== "volunteer" || !session.orgId) redirect("/login");
  return session as SessionClaims & { orgId: string };
}

/** Require a donor (self-service portal). */
export async function requireDonor(): Promise<SessionClaims & { orgId: string }> {
  const session = await requireSession();
  if (session.kind !== "donor" || !session.orgId) redirect("/login");
  return session as SessionClaims & { orgId: string };
}
