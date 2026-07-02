-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "PassStatus" AS ENUM ('active', 'revoked');

-- CreateTable
CREATE TABLE "volunteers" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "notes" TEXT,
    "status" "VolunteerStatus" NOT NULL DEFAULT 'active',
    "password_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteer_passes" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "volunteer_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "status" "PassStatus" NOT NULL DEFAULT 'active',
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "volunteer_passes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "volunteers_org_id_idx" ON "volunteers"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_org_id_email_key" ON "volunteers"("org_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "volunteer_passes_serial_key" ON "volunteer_passes"("serial");

-- CreateIndex
CREATE INDEX "volunteer_passes_org_id_idx" ON "volunteer_passes"("org_id");

-- CreateIndex
CREATE INDEX "volunteer_passes_volunteer_id_idx" ON "volunteer_passes"("volunteer_id");

-- AddForeignKey
ALTER TABLE "volunteers" ADD CONSTRAINT "volunteers_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_passes" ADD CONSTRAINT "volunteer_passes_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "volunteer_passes" ADD CONSTRAINT "volunteer_passes_volunteer_id_fkey" FOREIGN KEY ("volunteer_id") REFERENCES "volunteers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
