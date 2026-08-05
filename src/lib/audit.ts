import { adminDb } from "@/lib/db";
import { captureError } from "@/lib/observability";

/**
 * Append-only audit trail.
 *
 * CRA expects a registered charity to be able to explain, years later, who issued
 * or voided a given official receipt. Audit writes must therefore never be the
 * reason an operation fails — they are best-effort at the call site and reported
 * when they break, rather than propagated.
 */

export type Actor =
  | { type: "platform_admin"; id: string }
  | { type: "org_user"; id: string }
  | { type: "volunteer"; id: string }
  | { type: "donor"; id: string }
  | { type: "system"; id?: string };

export async function audit(args: {
  actor: Actor;
  orgId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  ip?: string;
}): Promise<void> {
  try {
    await adminDb.auditLog.create({
      data: {
        orgId: args.orgId ?? null,
        actorType: args.actor.type,
        actorId: args.actor.id ?? null,
        action: args.action,
        entityType: args.entityType,
        entityId: args.entityId,
        before: args.before === undefined ? undefined : (args.before as object),
        after: args.after === undefined ? undefined : (args.after as object),
        ip: args.ip,
      },
    });
  } catch (e) {
    captureError(e, { source: "audit", action: args.action, orgId: args.orgId });
  }
}
