import "server-only";

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import { connectLocal, isLocalDatabase } from "./local";
import { connectPostgres } from "./postgres";
import * as schema from "./schema";
import { timedFetch } from "./timed-fetch";

const url = process.env.DATABASE_URL!;
neonConfig.fetchFunction = timedFetch;

// Production is Supabase (node-postgres through Supabase's pooler; src/db/postgres.ts). A Neon URL
// still uses neon-http (one HTTP round trip per query), so switching DATABASE_URL back to Neon is a
// complete rollback. Either way db.batch([...]) is atomic, and there are no interactive transactions.
const isNeon = (u: string) => {
  try {
    return /\.neon\.tech$/i.test(new URL(u).hostname);
  } catch {
    return false;
  }
};

export const db = isLocalDatabase(url)
  ? connectLocal(url, schema)
  : isNeon(url)
    ? drizzle({ client: neon(url), schema })
    : connectPostgres(url, schema);
