/**
 * Create a platform super-admin in any database (use for production).
 *
 *   ADMIN_DATABASE_URL="postgres://..." \
 *   ADMIN_EMAIL="you@kindpath.app" ADMIN_NAME="Your Name" ADMIN_PASSWORD="a-strong-password" \
 *   npx tsx scripts/create-admin.ts
 *
 * Re-running with the same email updates the password.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  datasourceUrl: process.env.ADMIN_DATABASE_URL ?? process.env.DATABASE_URL,
});

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const name = process.env.ADMIN_NAME ?? "Platform Admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD env vars.");
  }
  if (password.length < 10) {
    throw new Error("Use a password of at least 10 characters.");
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.platformAdmin.upsert({
    where: { email },
    create: { email, name, role: "super_admin", passwordHash },
    update: { passwordHash, name },
  });
  console.log(`✅ Platform admin ready: ${email}`);
}

main()
  .catch((e) => {
    console.error("❌", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
