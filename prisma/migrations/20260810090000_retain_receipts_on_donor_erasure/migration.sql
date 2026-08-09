-- Donor erasure must never destroy statutory records.
--
-- donations.donor_id and receipts.donor_id were ON DELETE CASCADE, so the only
-- deletion mechanism available would have cascaded straight through the records
-- the Income Tax Act requires a charity to retain. RESTRICT makes that
-- impossible at the database level; erasure goes through anonymization
-- (donors.anonymized_at), which scrubs the living row while receipts keep the
-- donor_name_snapshot / donor_address_snapshot they were issued with.

-- DropForeignKey
ALTER TABLE "donations" DROP CONSTRAINT "donations_donor_id_fkey";

-- DropForeignKey
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_donor_id_fkey";

-- AlterTable
ALTER TABLE "donors" ADD COLUMN     "anonymized_at" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

