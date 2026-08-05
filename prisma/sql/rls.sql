-- Row-Level Security for KindPath multi-tenancy.
-- Applied after `prisma migrate`. Re-runnable (idempotent). Run via `npm run db:rls`,
-- which `db:deploy` invokes automatically so policies can never lag behind a migration.
--
-- Runtime model:
--   * The app connects as kindpath_app (non-superuser, subject to RLS).
--   * Tenant data is read/written inside a transaction that runs
--       SET LOCAL app.current_org_id = '<org uuid>'
--     (see src/lib/tenant.ts -> withTenant). Without it, tenant rows are invisible.
--   * Auth lookups and platform-admin/global ops use the superuser adminDb client.
--
-- IMPORTANT: the tenant table list is DERIVED FROM THE CATALOG, not hardcoded.
-- Any table with an `org_id` column is a tenant table and is protected automatically,
-- so a future migration cannot ship a new table without isolation. `organizations`
-- is special-cased (it keys on `id`). Tables without `org_id` (platform_admins,
-- webhook_events, _prisma_migrations) are global by design and left unprotected.
-- `scripts/verify-rls.ts` asserts this invariant and fails CI if it is ever violated.

-- ---- helper: current org from session GUC (NULL when unset => deny) ----
-- Prisma stores String ids as text, so this returns text to match id/org_id columns.
CREATE OR REPLACE FUNCTION current_org_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')
$$;

DO $$
DECLARE
  t text;
  granted int := 0;
  protected int := 0;
BEGIN
  -- ---- global tables: app-layer managed, no RLS (auth lookups happen pre-tenant) ----
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON platform_admins, webhook_events TO kindpath_app';
  EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kindpath_app';

  -- ---- organizations: tenant root, keys on id (not org_id) ----
  EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO kindpath_app';
  EXECUTE 'ALTER TABLE organizations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE organizations FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation ON organizations';
  EXECUTE 'CREATE POLICY org_isolation ON organizations
             USING (id = current_org_id())
             WITH CHECK (id = current_org_id())';

  -- ---- every table carrying org_id is a tenant table, discovered dynamically ----
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'org_id'
      AND a.attnum > 0
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO kindpath_app', t);
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I
                      USING (org_id = current_org_id())
                      WITH CHECK (org_id = current_org_id())', t);
    protected := protected + 1;
  END LOOP;

  RAISE NOTICE 'RLS applied: organizations + % tenant table(s) discovered via org_id', protected;
END $$;
