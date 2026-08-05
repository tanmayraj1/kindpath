-- Idempotency guard for the donation money path.
--
-- `provider_charge_ref` is the gateway's reference and is recorded on failed
-- attempts too, so it cannot itself carry a UNIQUE constraint. `charge_key` is
-- set ONLY on a succeeded donation, so Postgres' "many NULLs are fine" rule lets
-- a single unique index turn a double-submit into a catchable conflict instead of
-- two gifts — and two official tax receipts — for one charge.

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "charge_key" TEXT;

-- Backfill existing successful donations. If historical duplicates already exist
-- for a reference, only the earliest row claims the key; the rest stay NULL so
-- the unique index can be created. Any such duplicate is a pre-existing data
-- problem to reconcile by hand, not something this migration should mask.
UPDATE "donations" d
SET "charge_key" = d."provider_charge_ref"
FROM (
  SELECT "id",
         row_number() OVER (PARTITION BY "provider_charge_ref" ORDER BY "created_at", "id") AS rn
  FROM "donations"
  WHERE "status" = 'succeeded'
    AND "provider_charge_ref" IS NOT NULL
    AND "provider_charge_ref" <> ''
) ranked
WHERE d."id" = ranked."id" AND ranked.rn = 1;

-- CreateIndex
CREATE UNIQUE INDEX "donations_charge_key_key" ON "donations"("charge_key");

-- CreateIndex
CREATE INDEX "donations_provider_charge_ref_idx" ON "donations"("provider_charge_ref");
