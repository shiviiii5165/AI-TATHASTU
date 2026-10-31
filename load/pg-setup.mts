// Prepares a real local Postgres (with pgvector) for load tests and query plans:
// applies every migration through Drizzle's own migrator and switches on the
// flags the journeys use. Refuses any database that isn't on this machine.
//   docker run -d --name ait-load-pg -e POSTGRES_PASSWORD=postgres -p 127.0.0.1:55433:5432 \
//     pgvector/pgvector:pg17 -c max_connections=200
//   node load/pg-setup.mts
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

import { E2E_ENV } from "../e2e/support/env.ts";

const url = new URL(E2E_ENV.DATABASE_URL);
if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error(`refusing non-local database ${url.hostname}`);

const pool = new pg.Pool({ connectionString: E2E_ENV.DATABASE_URL, max: 2 });
await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
await migrate(drizzle({ client: pool }), { migrationsFolder: "src/db/migrations" });
await pool.query(`INSERT INTO feature_flags (key, enabled) VALUES ('learn_profile_api', true)
                  ON CONFLICT (key) DO UPDATE SET enabled = true`);
const { rows } = await pool.query("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
console.log(`migrated: ${rows[0].n} tables`);
await pool.end();
