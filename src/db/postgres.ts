import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { SUPABASE_ROOT_CA } from "./supabase-ca";

/**
 * Standard PostgreSQL (Supabase, a local Postgres, the E2E PGlite socket) through node-postgres,
 * keeping the one API the app was written against (the neon-http client):
 *
 *  - db.batch([...]) is ATOMIC: every query runs on one connection inside BEGIN/COMMIT, and any
 *    failure rolls all of them back, as neon-http's batch did. The queries are ordinary Drizzle
 *    builders created with `db`; while the batch runs, an AsyncLocalStorage store routes their
 *    execution to the transaction's connection.
 *  - TLS is verified. Supabase hosts verify against Supabase's root CA (not in Node's trust store);
 *    other remote hosts use the system store; only loopback may skip TLS.
 */

const batchClient = new AsyncLocalStorage<pg.PoolClient>();

/** Executes on the batch's transaction connection while one is open in this async context. */
class RoutingPool extends pg.Pool {
  // pg's query() is overloaded; pass every form through unchanged.
  query(...args: unknown[]): never {
    const client = batchClient.getStore();
    return (client ? (client.query as (...a: unknown[]) => unknown)(...args) : (super.query as (...a: unknown[]) => unknown).apply(this, args)) as never;
  }
}

const LOOPBACK = /^(localhost|127\.0\.0\.1|\[?::1\]?|host\.docker\.internal)$/i;

export function sslFor(host: string, sslmode: string | null): pg.PoolConfig["ssl"] {
  if (LOOPBACK.test(host)) return sslmode === "require" || sslmode === "verify-full" ? { rejectUnauthorized: false } : false;
  if (/\.supabase\.(com|co)$/i.test(host)) return { ca: SUPABASE_ROOT_CA, rejectUnauthorized: true, servername: host };
  return { rejectUnauthorized: true, servername: host };
}

/** Pool settings from a postgres:// URL. TLS comes from sslFor(), never from the URL's sslmode. */
export function poolConfig(url: string): pg.PoolConfig {
  const u = new URL(url);
  const timeout = Number(process.env.DB_QUERY_TIMEOUT_MS) || 20_000;
  return {
    host: u.hostname.replace(/^\[|\]$/g, ""),
    port: Number(u.port) || 5432,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.replace(/^\//, "")) || "postgres",
    ssl: sslFor(u.hostname, u.searchParams.get("sslmode")),
    max: Number(process.env.DB_POOL_MAX) || 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: timeout,
    query_timeout: timeout,
    application_name: "ai-tathastu-web",
  };
}

export function connectPostgres<S extends Record<string, unknown>>(url: string, schema: S): NeonHttpDatabase<S> {
  const pool = new RoutingPool(poolConfig(url));
  // An idle client losing its connection must not crash the process.
  pool.on("error", (error) => console.error("db pool error", { kind: error.name }));
  const db = drizzle({ client: pool, schema }) as unknown as NeonHttpDatabase<S> & {
    batch: (queries: readonly PromiseLike<unknown>[]) => Promise<unknown[]>;
  };
  db.batch = (async (queries: readonly PromiseLike<unknown>[]) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const results = await batchClient.run(client, async () => {
        const out: unknown[] = [];
        for (const q of queries) out.push(await q);
        return out;
      });
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }) as never;
  return db;
}
