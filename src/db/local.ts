import "server-only";

import { createRequire } from "node:module";
import path from "node:path";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

/** postgres://…@localhost or 127.0.0.1: a local Postgres, never Neon. */
export function isLocalDatabase(url: string | undefined) {
  return Boolean(url && /^postgres(ql)?:\/\/([^@/]*@)?(localhost|127\.0\.0\.1)[:/]/.test(url));
}

/**
 * node-postgres for a local database (the E2E stack's PGlite socket server, or
 * a Postgres in Docker). `pg` is a dev dependency loaded only on this path, so
 * production bundles never include it.
 *
 * Typed as the Neon client so callers keep one API. node-postgres has no
 * batch(); the shim runs the queries in order, which is enough for tests but
 * not atomic.
 */
export function connectLocal<S extends Record<string, unknown>>(url: string, schema: S): NeonHttpDatabase<S> {
  const load = createRequire(path.join(process.cwd(), "package.json"));
  const { Pool } = load("pg") as typeof import("pg");
  const { drizzle } = load("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");

  // Same deadline as production's timedFetch, so failure tests behave alike. The pool
  // size is only raised for load tests against a real Postgres (PGlite is one connection).
  const timeout = Number(process.env.DB_QUERY_TIMEOUT_MS) || 20_000;
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.LOCAL_DB_POOL_MAX) || 4,
    query_timeout: timeout,
    connectionTimeoutMillis: timeout,
  });
  // An idle client losing its connection must not crash the process.
  pool.on("error", (error) => console.error("db pool error", { kind: error.name }));
  const db = drizzle({ client: pool, schema }) as NodePgDatabase<S> & {
    batch?: (queries: PromiseLike<unknown>[]) => Promise<unknown[]>;
  };
  db.batch = async (queries) => {
    const results = [];
    for (const q of queries) results.push(await q);
    return results;
  };
  return db as unknown as NeonHttpDatabase<S>;
}
