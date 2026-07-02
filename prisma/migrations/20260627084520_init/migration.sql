-- CreateEnum
CREATE TYPE "CharityStatus" AS ENUM ('registered', 'non_registered');

-- CreateEnum
CREATE TYPE "ReceiptMode" AS ENUM ('per_gift', 'annual', 'both');

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended', 'archived');

-- CreateEnum
CREATE TYPE "OrgUserRole" AS ENUM ('org_admin', 'signatory', 'staff');

-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('super_admin', 'support');

-- CreateEnum
CREATE TYPE "SubscriptionPlan" AS ENUM ('starter', 'community', 'enterprise');

-- CreateEnum
CREATE TYPE "BillingCycle" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'cancelled');

-- CreateEnum
CREATE TYPE "AddressStatus" AS ENUM ('complete', 'pending');

-- CreateEnum
CREATE TYPE "CaslConsent" AS ENUM ('express', 'implied', 'none');

-- CreateEnum
CREATE TYPE "PaymentMethodType" AS ENUM ('card', 'bank');

-- CreateEnum
CREATE TYPE "PaymentMethodStatus" AS ENUM ('active', 'expired', 'removed');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('weekly', 'monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('active', 'paused', 'cancelled', 'suspended');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('one_time', 'recurring', 'cash', 'cheque');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded');

-- CreateEnum
CREATE TYPE "ReceiptType" AS ENUM ('official', 'confirmation', 'annual');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('issued', 'voided', 'replaced');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('queued', 'sent', 'failed');

-- CreateTable
CREATE TABLE "platform_admins" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'super_admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "provider_event_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_url" TEXT,
    "primary_color" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "charity_status" "CharityStatus" NOT NULL DEFAULT 'non_registered',
    "cra_registration_number" TEXT,
    "authorized_signatory_name" TEXT,
    "signatory_signature_url" TEXT,
    "receipt_mode" "ReceiptMode" NOT NULL DEFAULT 'per_gift',
    "min_receipt_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "receipt_locality" TEXT,
    "default_currency" TEXT NOT NULL DEFAULT 'CAD',
    "pos_credentials_ref" TEXT,
    "status" "OrgStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_users" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "OrgUserRole" NOT NULL DEFAULT 'org_admin',
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "org_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "plan" "SubscriptionPlan" NOT NULL DEFAULT 'starter',
    "cycle" "BillingCycle" NOT NULL DEFAULT 'monthly',
    "price_cad" DECIMAL(10,2) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "current_period_start" TIMESTAMP(3),
    "current_period_end" TIMESTAMP(3),
    "next_billing_date" TIMESTAMP(3),
    "trial_ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax_rate" DECIMAL(5,4) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "province" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pdf_url" TEXT,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donors" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_initial" TEXT,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "province" TEXT,
    "postal_code" TEXT,
    "country" TEXT NOT NULL DEFAULT 'CA',
    "address_status" "AddressStatus" NOT NULL DEFAULT 'pending',
    "casl_consent_status" "CaslConsent" NOT NULL DEFAULT 'none',
    "casl_consent_at" TIMESTAMP(3),
    "casl_consent_source" TEXT,
    "email_marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "sms_marketing_opt_in" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "password_hash" TEXT,
    "google_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "donors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_payment_methods" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "donor_id" TEXT NOT NULL,
    "provider_token" TEXT NOT NULL,
    "type" "PaymentMethodType" NOT NULL DEFAULT 'card',
    "brand" TEXT,
    "last4" TEXT,
    "exp_month" INTEGER,
    "exp_year" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" "PaymentMethodStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donor_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funds" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_plans" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "donor_id" TEXT NOT NULL,
    "fund_id" TEXT,
    "payment_method_id" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "frequency" "Frequency" NOT NULL DEFAULT 'monthly',
    "billing_day" INTEGER,
    "next_billing_date" TIMESTAMP(3),
    "status" "PlanStatus" NOT NULL DEFAULT 'active',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "provider_recurring_ref" TEXT,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMP(3),

    CONSTRAINT "recurring_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "donor_id" TEXT NOT NULL,
    "fund_id" TEXT,
    "recurring_plan_id" TEXT,
    "type" "DonationType" NOT NULL DEFAULT 'one_time',
    "amount" DECIMAL(10,2) NOT NULL,
    "advantage_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "advantage_description" TEXT,
    "eligible_amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "status" "DonationStatus" NOT NULL DEFAULT 'pending',
    "payment_method_id" TEXT,
    "provider_charge_ref" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipts" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "donation_id" TEXT,
    "donor_id" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL,
    "document_type" "ReceiptType" NOT NULL DEFAULT 'official',
    "donor_name_snapshot" TEXT NOT NULL,
    "donor_address_snapshot" TEXT NOT NULL,
    "org_name_snapshot" TEXT NOT NULL,
    "org_reg_number_snapshot" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "advantage_value" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "eligible_amount" DECIMAL(10,2) NOT NULL,
    "place_issued" TEXT,
    "date_donation_received" TIMESTAMP(3) NOT NULL,
    "date_issued" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signatory_name_snapshot" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'issued',
    "void_reason" TEXT,
    "replaces_serial" TEXT,
    "pdf_url" TEXT,
    "year" INTEGER NOT NULL,

    CONSTRAINT "receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt_sequences" (
    "org_id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "last_number" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("org_id","year")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "donor_id" TEXT,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'email',
    "category" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'queued',
    "casl_checked" BOOLEAN NOT NULL DEFAULT false,
    "provider_ref" TEXT,
    "sent_at" TIMESTAMP(3),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "org_id" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_admins_email_key" ON "platform_admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_id_key" ON "webhook_events"("provider_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "org_users_org_id_idx" ON "org_users"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "org_users_org_id_email_key" ON "org_users"("org_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_org_id_key" ON "subscriptions"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_invoices_invoice_number_key" ON "subscription_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "subscription_invoices_org_id_idx" ON "subscription_invoices"("org_id");

-- CreateIndex
CREATE INDEX "donors_org_id_idx" ON "donors"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "donors_org_id_email_key" ON "donors"("org_id", "email");

-- CreateIndex
CREATE INDEX "donor_payment_methods_org_id_donor_id_idx" ON "donor_payment_methods"("org_id", "donor_id");

-- CreateIndex
CREATE INDEX "funds_org_id_idx" ON "funds"("org_id");

-- CreateIndex
CREATE INDEX "recurring_plans_org_id_status_next_billing_date_idx" ON "recurring_plans"("org_id", "status", "next_billing_date");

-- CreateIndex
CREATE INDEX "donations_org_id_received_at_idx" ON "donations"("org_id", "received_at");

-- CreateIndex
CREATE INDEX "donations_org_id_donor_id_idx" ON "donations"("org_id", "donor_id");

-- CreateIndex
CREATE INDEX "donations_org_id_fund_id_idx" ON "donations"("org_id", "fund_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_donation_id_key" ON "receipts"("donation_id");

-- CreateIndex
CREATE INDEX "receipts_org_id_donor_id_year_idx" ON "receipts"("org_id", "donor_id", "year");

-- CreateIndex
CREATE UNIQUE INDEX "receipts_org_id_serial_number_key" ON "receipts"("org_id", "serial_number");

-- CreateIndex
CREATE INDEX "notifications_org_id_idx" ON "notifications"("org_id");

-- CreateIndex
CREATE INDEX "audit_log_org_id_idx" ON "audit_log"("org_id");

-- AddForeignKey
ALTER TABLE "org_users" ADD CONSTRAINT "org_users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donors" ADD CONSTRAINT "donors_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_payment_methods" ADD CONSTRAINT "donor_payment_methods_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donor_payment_methods" ADD CONSTRAINT "donor_payment_methods_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "funds" ADD CONSTRAINT "funds_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_plans" ADD CONSTRAINT "recurring_plans_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "donor_payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_fund_id_fkey" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_recurring_plan_id_fkey" FOREIGN KEY ("recurring_plan_id") REFERENCES "recurring_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_donation_id_fkey" FOREIGN KEY ("donation_id") REFERENCES "donations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "donors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt_sequences" ADD CONSTRAINT "receipt_sequences_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
