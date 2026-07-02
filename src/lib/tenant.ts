import { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Run a callback with tenant context set, so Postgres RLS scopes every query
 * to the given org. The whole callback runs in ONE transaction/connection, so
 * `SET LOCAL app.current_org_id` applies to all queries inside it and is
 * automatically cleared when the transaction ends.
 *
 * Always go through this for tenant data when using the `db` (app-role) client.
 */
export async function withTenant<T>(
  orgId: string,
  cb: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return db.$transaction(async (tx) => {
    // set_config(name, value, is_local=true) === SET LOCAL, parameterized safely
    await tx.$executeRaw`SELECT set_config('app.current_org_id', ${orgId}, true)`;
    return cb(tx);
  });
}
