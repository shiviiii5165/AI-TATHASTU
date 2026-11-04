// Upserts the academic catalogue (src/db/seeds/academic-catalog.ts).
//
//   npm run db:seed:academic             # apply to DATABASE_URL (env, else .env.local)
//   npm run db:seed:academic -- --print  # print the SQL (how migration 0010 was made)
//
// Idempotent: existing rows are updated by name, nothing is deleted, and
// users' links to institutions, degrees and specializations are untouched.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { academicSeedStatements } from "../src/db/seeds/academic-seed-sql";
import { assertWriteAllowed } from "./lib/db-target.mjs";

async function main() {
  const statements = academicSeedStatements();
  if (process.argv.includes("--print")) {
    console.log(statements.join("\n--> statement-breakpoint\n"));
    return 0;
  }
  if (!process.env.DATABASE_URL) config({ path: ".env.local", quiet: true });
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    return 2;
  }
  assertWriteAllowed(url);
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    for (const s of statements) await pool.query(s);
    await pool.end();
  } else {
    const sql = neon(url);
    // One HTTP transaction: the catalogue is never half-updated.
    await sql.transaction(statements.map((s) => sql.query(s)));
  }
  console.log(`academic catalogue upserted: ${statements.length} rows`);
  return 0;
}

main().then((code) => process.exit(code));
