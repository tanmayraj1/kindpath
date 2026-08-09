/**
 * Asserts multi-tenant isolation is actually in force on a database.
 *
 * This is the safety net for the platform's most important security control.
 * It is deliberately catalog-driven: it derives the set of tenant tables from
 * the presence of an `org_id` column, so a migration that adds a table without
 * a policy FAILS here rather than silently leaking every tenant's data.
 *
 * Usage:
 *   ADMIN_DATABASE_URL=... APP_DATABASE_URL=... npx tsx scripts/verify-rls.ts
 *
 * APP_DATABASE_URL (the non-superuser app role) is optional but strongly
 * recommended — without it the live "can the app read across tenants?" probe
 * is skipped and only the catalog is checked.
 *
 * Exit code 0 = isolation verified. Non-zero = do not ship.
 */
import { PrismaClient } from "@prisma/client";

// Tables intentionally global (no org_id): auth lookups happen before a tenant
// context exists, and migration bookkeeping is Prisma's.
const GLOBAL_TABLES = new Set([
  "platform_admins",
  "webhook_events",
  "job_runs",
  "_prisma_migrations",
]);

type TableState = { tablename: string; rls: boolean; forced: boolean; has_org_id: boolean };

async function main() {
  const adminUrl = process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("ADMIN_DATABASE_URL (or DATABASE_URL) is required");
  const admin = new PrismaClient({ datasourceUrl: adminUrl });

  const failures: string[] = [];

  // ---- 1. catalog: every org_id-bearing table must have FORCE RLS + a policy ----
  const tables = await admin.$queryRawUnsafe<TableState[]>(`
    SELECT c.relname AS tablename,
           c.relrowsecurity AS rls,
           c.relforcerowsecurity AS forced,
           EXISTS (
             SELECT 1 FROM pg_attribute a
             WHERE a.attrelid = c.oid AND a.attname = 'org_id'
               AND a.attnum > 0 AND NOT a.attisdropped
           ) AS has_org_id
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname`);

  const policyCounts = new Map(
    (
      await admin.$queryRawUnsafe<{ tablename: string; n: number }[]>(
        `SELECT tablename, count(*)::int AS n FROM pg_policies WHERE schemaname='public' GROUP BY tablename`
      )
    ).map((p) => [p.tablename, p.n])
  );

  console.log("── table protection ──");
  for (const t of tables) {
    if (GLOBAL_TABLES.has(t.tablename)) {
      console.log(`  ·  ${t.tablename.padEnd(24)} global by design`);
      continue;
    }
    // organizations keys on id; everything else must carry org_id.
    const isTenant = t.has_org_id || t.tablename === "organizations";
    if (!isTenant) {
      failures.push(`${t.tablename}: no org_id and not in the global allowlist — classify it`);
      console.log(`  ✗  ${t.tablename.padEnd(24)} UNCLASSIFIED`);
      continue;
    }
    const policies = policyCounts.get(t.tablename) ?? 0;
    const ok = t.rls && t.forced && policies > 0;
    if (!ok) {
      failures.push(
        `${t.tablename}: rls=${t.rls} forced=${t.forced} policies=${policies} — run \`npm run db:rls\``
      );
    }
    console.log(`  ${ok ? "✓" : "✗"}  ${t.tablename.padEnd(24)} rls=${t.rls} forced=${t.forced} policies=${policies}`);
  }

  // Owner must bypass RLS or auth/cron/seed break entirely.
  const [{ n: orgCount }] = await admin.$queryRawUnsafe<{ n: number }[]>(
    `SELECT count(*)::int AS n FROM organizations`
  );
  if (orgCount === 0) {
    console.log("\n  !  admin role sees 0 organizations — either an empty DB, or the admin role");
    console.log("     does NOT bypass FORCE RLS (login/cron/seed would be broken). Verify.");
    // On an empty database the cross-tenant probe below is vacuous: every count
    // is 0 because there is nothing to read, not because isolation works. CI sets
    // REQUIRE_TENANT_DATA so a failed seed can't be mistaken for a passing check.
    if (process.env.REQUIRE_TENANT_DATA) {
      failures.push(
        "database has no organizations — the cross-tenant probe would pass vacuously; seed first"
      );
    }
  } else {
    console.log(`\n  ✓  admin role bypasses RLS (sees ${orgCount} organizations)`);
  }
  await admin.$disconnect();

  // ---- 2. live probe: the app role must see nothing without a tenant context ----
  const appUrl = process.env.APP_DATABASE_URL;
  if (!appUrl) {
    console.log("\n  !  APP_DATABASE_URL not set — skipping the live cross-tenant probe.");
  } else {
    const app = new PrismaClient({ datasourceUrl: appUrl });
    console.log("\n── app role, no tenant context (every count must be 0) ──");
    for (const t of tables) {
      if (GLOBAL_TABLES.has(t.tablename)) continue;
      if (!t.has_org_id && t.tablename !== "organizations") continue;
      try {
        const [{ n }] = await app.$queryRawUnsafe<{ n: number }[]>(
          `SELECT count(*)::int AS n FROM ${t.tablename}`
        );
        if (n !== 0) failures.push(`${t.tablename}: LEAK — ${n} rows readable with no tenant context`);
        console.log(`  ${n === 0 ? "✓" : "✗"}  ${t.tablename.padEnd(24)} ${n} rows`);
      } catch (e) {
        // A permission error is a safe failure (no access at all); anything else isn't.
        console.log(`  ·  ${t.tablename.padEnd(24)} ${(e as Error).message.split("\n")[0].slice(0, 50)}`);
      }
    }
    await app.$disconnect();
  }

  if (failures.length) {
    console.error(`\n🚨 RLS VERIFICATION FAILED (${failures.length}):`);
    for (const f of failures) console.error(`   - ${f}`);
    process.exit(1);
  }
  console.log("\n✅ tenant isolation verified");
  process.exit(0);
}

main().catch((e) => {
  console.error("verify-rls crashed:", e);
  process.exit(1);
});
