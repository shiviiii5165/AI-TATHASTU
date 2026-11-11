// Queues a compute_intelligence job for each finished, non-deleted user. It writes nothing
// else: the worker works out each user's intelligence from their own evidence.
//
//   npx tsx scripts/backfill-independent-intelligence.ts            # dry run: counts only
//   npx tsx scripts/backfill-independent-intelligence.ts --apply    # queues the jobs
//   ... --batch=engine-v3-score [--apply]   # a new batch: re-queues users an older batch already processed
//
// Reads DATABASE_URL from the environment only, never from .env files, so the target is
// always what the operator set for this command. See scripts/lib/db-target.mjs for what a
// remote host requires. Safe to re-run: a batch queues each user at most once.
import { neon } from "@neondatabase/serverless";

import { assertWriteAllowed, hostOf, isLocalDatabase } from "./lib/db-target.mjs";
import { enqueueIntelligence } from "./lib/enqueue-intelligence.mjs";

type Row = Record<string, unknown>;

async function connect(url: string) {
  if (isLocalDatabase(url)) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    return { query: async (t: string, p: unknown[]) => (await pool.query(t, p)).rows as Row[], close: () => pool.end() };
  }
  const sql = neon(url);
  return { query: (t: string, p: unknown[]) => sql.query(t, p) as Promise<Row[]>, close: async () => {} };
}

async function main() {
  const apply = process.argv.includes("--apply");
  // A new batch name re-queues users already processed under an older batch (e.g. engine-v3-score).
  const batchArg = process.argv.find((a) => a.startsWith("--batch="))?.slice("--batch=".length);
  if (batchArg !== undefined && !/^[a-z0-9][a-z0-9._-]{1,40}$/i.test(batchArg)) throw new Error("--batch must be 2-41 letters, digits, '.', '_' or '-'.");
  const batch = batchArg ?? "engine-v1";
  // Even a dry run lists users, so it needs the same approval as a write.
  const url = assertWriteAllowed(process.env.DATABASE_URL);
  const { query, close } = await connect(url);
  try {
    const result = await enqueueIntelligence(query, { apply, batch });
    console.log({ host: hostOf(url), batch, ...result });
    if (!apply) console.log("Dry run. Re-run with --apply to queue the jobs.");
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});