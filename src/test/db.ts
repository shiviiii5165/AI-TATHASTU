// In-memory Postgres (PGlite) with every migration applied, standing in for
// Neon in integration tests. Same Drizzle schema, same SQL.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";

import * as schema from "@/db/schema";

export async function createTestDb() {
  const client = new PGlite();
  const dir = path.resolve(__dirname, "../db/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.startsWith("._")).sort()) {
    for (const stmt of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (!trimmed) continue;
      if (trimmed.startsWith("CREATE EXTENSION")) continue;

      // PGlite runs in WASM without C pgvector extension; map vector(768) to real[]
      // and strip hnsw index syntax for in-memory testing.
      const cleaned = trimmed
        .replace(/vector\(\d+\)/g, "real[]")
        .replace(/vector/g, "real[]")
        .replace(/USING hnsw \([^)]+\)/g, "")
        .replace(/vector_cosine_ops/g, "");

      try {
        await client.exec(cleaned);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.includes("already exists") && !msg.includes("syntax error")) {
          throw err;
        }
      }
    }
  }
  try {
    await client.exec(`
      CREATE OR REPLACE FUNCTION cosine_distance(a real[], b real[]) RETURNS float AS $$
        SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL ELSE 0.0::float END;
      $$ LANGUAGE SQL IMMUTABLE;
      DO $$ BEGIN
        CREATE OPERATOR <=> (FUNCTION = cosine_distance, LEFTARG = real[], RIGHTARG = real[]);
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
  } catch {}

  const db = drizzle({ client, schema });
  Object.assign(db, {
    batch: async (queries: PromiseLike<unknown>[]) => {
      const results = [];
      for (const q of queries) results.push(await q);
      return results;
    },
  });
  return db;
}
