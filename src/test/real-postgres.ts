// Real Postgres for *.pgtest.ts. Wipes the database it's given, so it refuses anything but a local one.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { drizzle } from "drizzle-orm/node-postgres";
import { Client, Pool } from "pg";

import * as schema from "@/db/schema";

export function testPostgresUrl() {
  const url = process.env.TEST_POSTGRES_URL ?? "";
  if (!/^postgres(ql)?:\/\/[^@]*@(127\.0\.0\.1|localhost)[:/]/.test(url)) {
    throw new Error("TEST_POSTGRES_URL must point at a throwaway database on localhost");
  }
  return url;
}

/** Empties the database and applies every migration, stopping at the first error. */
export async function resetAndMigrate() {
  const client = new Client({ connectionString: testPostgresUrl() });
  await client.connect();
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  const dir = path.resolve(import.meta.dirname, "../db/migrations");
  const applied: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await client.query(statement);
    }
    applied.push(file);
  }
  await client.end();
  return applied;
}

/** A pool, so parallel calls really use separate connections. */
export function createPoolDb() {
  const db = drizzle({ client: new Pool({ connectionString: testPostgresUrl(), max: 20 }), schema });
  // Runs in order, but NOT as one transaction: the queries are already bound to the pool.
  // Neon's batch atomicity isn't proven here.
  Object.assign(db, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      const results = [];
      for (const query of queries) results.push(await query);
      return results;
    },
  });
  return db;
}
