import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";

const options = {
  database: db,
  emailAndPassword: { enabled: true },
  plugins: [nextCookies()],
} satisfies BetterAuthOptions;

export const auth = betterAuth(options);

// Create/upgrade Better Auth's own tables (user, session, account, verification)
// with its migrator — the same plan `bunx auth migrate` applies. Runs once per process.
async function migrateAuthTables() {
  try {
    const { runMigrations } = await getMigrations(options);
    await runMigrations();
  } catch (err) {
    // Another process (e.g. a parallel build worker) may have created them first.
    const { toBeCreated, toBeAdded } = await getMigrations(options);
    if (toBeCreated.length || toBeAdded.length) throw err;
  }
}

const globalForAuth = globalThis as unknown as { __authMigrated?: Promise<void> };
globalForAuth.__authMigrated ??= migrateAuthTables();
await globalForAuth.__authMigrated;
