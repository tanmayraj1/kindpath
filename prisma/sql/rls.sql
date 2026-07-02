-- Row-Level Security for KindPath multi-tenancy.
-- Applied as superuser AFTER `prisma migrate`. Re-runnable (idempotent).
--
-- Runtime model:
--   * The app connects as kindpath_app (non-superuser, subject to RLS).
--   * Tenant data is read/written inside a transaction that runs
--       SET LOCAL app.current_org_id = '<org uuid>'
--     (see src/lib/tenant.ts -> withTenant). Without it, tenant rows are invisible.
--   * Auth lookups and platform-admin/global ops use the superuser adminDb client.

-- ---- grants: tenant tables (full DML for the app role) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON
  organizations, org_users, subscriptions, subscription_invoices,
  donors, donor_payment_methods, funds, recurring_plans, donations,
  receipts, receipt_sequences, notifications, audit_log, campaigns,
  membership_plans, events, ticket_types, pledges,
  volunteers, volunteer_passes
TO kindpath_app;

-- ---- grants: global tables (managed at app layer, no RLS) ----
GRANT SELECT, INSERT, UPDATE, DELETE ON platform_admins, webhook_events TO kindpath_app;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kindpath_app;

-- ---- helper: current org from session GUC (NULL when unset => deny) ----
-- Prisma stores String ids as text, so this returns text to match id/org_id columns.
DROP FUNCTION IF EXISTS current_org_id() CASCADE;
CREATE OR REPLACE FUNCTION current_org_id() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_org_id', true), '')
$$;

-- ---- enable + force RLS and define policies per tenant table ----
DO $$
DECLARE
  t text;
  tenant_tables text[] := ARRAY[
    'org_users','subscriptions','subscription_invoices','donors',
    'donor_payment_methods','funds','recurring_plans','donations',
    'receipts','receipt_sequences','notifications','audit_log','campaigns',
    'membership_plans','events','ticket_types','pledges',
    'volunteers','volunteer_passes'
  ];
BEGIN
  -- organizations keys on id (not org_id)
  EXECUTE 'ALTER TABLE organizations ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE organizations FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS org_isolation ON organizations';
  EXECUTE 'CREATE POLICY org_isolation ON organizations
             USING (id = current_org_id())
             WITH CHECK (id = current_org_id())';

  FOREACH t IN ARRAY tenant_tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I
                      USING (org_id = current_org_id())
                      WITH CHECK (org_id = current_org_id())', t);
  END LOOP;
END $$;
