-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'active', 'closed');

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "campaign_id" TEXT;

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "fund_id" TEXT,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "goal_amount" DECIMAL(12,2) NOT NULL,
    "deadline" TIMESTAMP(3),
    "status" "CampaignStatus" NOT NULL DEFAULT 'active',
    "accent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "campaigns_org_id_idx" ON "campaigns"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "campaigns_org_id_slug_key" ON "campaigns"("org_id", "slug");

-- CreateIndex
CREATE INDEX "donations_org_id_campaign_id_idx" ON "donations"("org_id", "campaign_id");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE CASCADE;
