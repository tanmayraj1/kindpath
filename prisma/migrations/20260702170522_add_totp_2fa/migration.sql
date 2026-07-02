-- AlterTable
ALTER TABLE "org_users" ADD COLUMN     "totp_enabled_at" TIMESTAMP(3),
ADD COLUMN     "totp_recovery_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "totp_secret" TEXT;
