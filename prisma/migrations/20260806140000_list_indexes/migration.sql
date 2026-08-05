-- Composite indexes backing the list pages' default sorts and filters.
-- Without these every list page's ORDER BY is a full scan + sort of the
-- tenant's rows, which is fine at seed scale and not at real scale.

-- CreateIndex
CREATE INDEX "audit_log_org_id_created_at_idx" ON "audit_log"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "donors_org_id_created_at_idx" ON "donors"("org_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_org_id_status_created_at_idx" ON "notifications"("org_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "receipts_org_id_date_issued_idx" ON "receipts"("org_id", "date_issued");

-- CreateIndex
CREATE INDEX "receipts_org_id_replaces_serial_idx" ON "receipts"("org_id", "replaces_serial");

-- CreateIndex
CREATE INDEX "subscription_invoices_org_id_issued_at_idx" ON "subscription_invoices"("org_id", "issued_at");

