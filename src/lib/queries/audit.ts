import { adminDb } from "@/lib/db";
import { paged, type PageParams } from "@/lib/pagination";

/**
 * The audit trail, with the columns that make it an audit.
 *
 * `src/lib/audit.ts` records actorId, entityId, before, after and ip, and the
 * only view rendered four columns — none of them. It could tell you that
 * *somebody* voided *a receipt*, which is precisely the question an audit is
 * asked to answer and precisely what it could not.
 */

export type AuditFilters = { action?: string; orgId?: string; actor?: string };

export type AuditRow = {
  id: string;
  createdAt: Date;
  actorType: string;
  actorId: string | null;
  actorLabel: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  orgId: string | null;
  orgName: string | null;
  ip: string | null;
  changes: { field: string; before: unknown; after: unknown }[];
};

/** Field-level diff, so a reader sees what actually changed rather than two blobs. */
function diff(before: unknown, after: unknown) {
  const b = (before ?? {}) as Record<string, unknown>;
  const a = (after ?? {}) as Record<string, unknown>;
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  return keys
    .filter((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]))
    .map((k) => ({ field: k, before: b[k], after: a[k] }));
}

export async function listAuditLog(page: PageParams, filters: AuditFilters = {}) {
  const where = {
    ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" as const } } : {}),
    ...(filters.orgId ? { orgId: filters.orgId } : {}),
    ...(filters.actor ? { actorType: filters.actor } : {}),
    ...(page.q
      ? {
          OR: [
            { action: { contains: page.q, mode: "insensitive" as const } },
            { entityId: { contains: page.q, mode: "insensitive" as const } },
            { actorId: { contains: page.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    adminDb.auditLog.count({ where }),
    adminDb.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page.skip,
      take: page.size,
    }),
  ]);

  // Resolve names for just the page on screen — never the whole actor table.
  const orgIds = Array.from(new Set(rows.map((r) => r.orgId).filter((x): x is string => !!x)));
  const adminIds = Array.from(
    new Set(rows.filter((r) => r.actorType === "platform_admin").map((r) => r.actorId).filter((x): x is string => !!x))
  );
  const userIds = Array.from(
    new Set(rows.filter((r) => r.actorType === "org_user").map((r) => r.actorId).filter((x): x is string => !!x))
  );

  const [orgs, admins, users] = await Promise.all([
    orgIds.length
      ? adminDb.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } })
      : [],
    adminIds.length
      ? adminDb.platformAdmin.findMany({ where: { id: { in: adminIds } }, select: { id: true, name: true, email: true } })
      : [],
    userIds.length
      ? adminDb.orgUser.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
      : [],
  ]);

  const orgById = new Map(orgs.map((o) => [o.id, o.name]));
  const nameById = new Map<string, string>([
    ...admins.map((a) => [a.id, `${a.name} (${a.email})`] as const),
    ...users.map((u) => [u.id, `${u.name} (${u.email})`] as const),
  ]);

  const mapped: AuditRow[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    actorType: r.actorType,
    actorId: r.actorId,
    // "who", not just "what kind of who" — the point of an accountability record.
    actorLabel:
      (r.actorId && nameById.get(r.actorId)) ??
      (r.actorType === "system" ? "System" : r.actorId ?? "—"),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    orgId: r.orgId,
    orgName: r.orgId ? orgById.get(r.orgId) ?? null : null,
    ip: r.ip,
    changes: diff(r.before, r.after),
  }));

  return paged(mapped, total, page);
}

/** Distinct actions present, for the filter dropdown. */
export async function auditActions(): Promise<string[]> {
  const rows = await adminDb.auditLog.groupBy({
    by: ["action"],
    _count: { _all: true },
    orderBy: { action: "asc" },
    take: 100,
  });
  return rows.map((r) => r.action);
}
