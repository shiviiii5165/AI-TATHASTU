import "server-only";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { connectPostgres } from "./postgres";

/** postgres://…@localhost or 127.0.0.1: a local Postgres, never Neon. */
export function isLocalDatabase(url: string | undefined) {
  return Boolean(url && /^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url));
}

/**
 * A local database (the E2E stack's PGlite socket server, or a Postgres in Docker). Same client as
 * production Supabase (src/db/postgres.ts), so batches are atomic here too. The pool size is only
 * raised for load tests against a real Postgres (PGlite is one connection).
 */
export function connectLocal<S extends Record<string, unknown>>(url: string, schema: S): NeonHttpDatabase<S> {
  if (!process.env.DB_POOL_MAX && process.env.LOCAL_DB_POOL_MAX) process.env.DB_POOL_MAX = process.env.LOCAL_DB_POOL_MAX;
  return connectPostgres(url, schema);
}
