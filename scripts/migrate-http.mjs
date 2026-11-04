// Applies src/db/migrations over Neon's HTTPS endpoint (port 443), for
// networks that block Postgres' port 5432.
//
// Uses drizzle-orm's own neon-http migrator, which keeps the same ledger as
// `drizzle-kit migrate` (drizzle.__drizzle_migrations: sha256 hash + journal
// timestamp), so the two commands can be used interchangeably.
// Caveat: HTTP has no transactions; a failing statement leaves earlier
// statements of that migration applied. Run against a Neon branch first.
//
//   npm run db:migrate:http

import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { assertWriteAllowed } from "./lib/db-target.mjs";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error: console.error });
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set (.env.local)");

const sql = neon(assertWriteAllowed(process.env.DATABASE_URL));
const db = drizzle({ client: sql });

const before = await applied();
await migrate(db, { migrationsFolder: "src/db/migrations" });
const after = await applied();
console.log(`migrations applied: ${before} before, ${after} now (+${after - before})`);

async function applied() {
  try {
    const [row] = await sql`select count(*)::int as n from drizzle.__drizzle_migrations`;
    return row.n;
  } catch {
    return 0; // ledger doesn't exist yet
  }
}
