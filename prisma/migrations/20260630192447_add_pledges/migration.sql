-- CreateEnum
CREATE TYPE "PledgeStatus" AS ENUM ('open', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "pledges" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "campaign_id" TEXT,
    "donor_name" TEXT NOT NULL,
    "donor_email" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PledgeStatus" NOT NULL DEFAULT 'open',
    "due_date" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pledges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pledges_org_id_idx" ON "pledges"("org_id");

-- AddForeignKey
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
