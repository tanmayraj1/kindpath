import { PrismaClient } from "@prisma/client";
import { assertEnv } from "./env";

assertEnv();

/**
 * Two clients, two security postures:
 *   - `db`      → connects as the non-superuser app role. RLS is ENFORCED.
 *                 Tenant data MUST be accessed via withTenant() (see tenant.ts),
 *                 which sets app.current_org_id for the transaction.
 *   - `adminDb` → connects as superuser. BYPASSES RLS. Use ONLY for:
 *                 auth lookups (pre-tenant), platform-admin/global ops, seeding,
 *                 and background billing jobs.
 */
const globalForPrisma = globalThis as unknown as {
  db?: PrismaClient;
  adminDb?: PrismaClient;
};

export const db =
  globalForPrisma.db ??
  new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
  });

export const adminDb =
  globalForPrisma.adminDb ??
  new PrismaClient({
    datasourceUrl: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.db = db;
  globalForPrisma.adminDb = adminDb;
}
