// Queues compute_matches for every onboarded student, so users who finished
// onboarding before matching existed get their dashboard matches.
//
//   npx tsx scripts/backfill-matches.ts            # dry run: counts only
//   npx tsx scripts/backfill-matches.ts --apply    # queues the jobs, wakes the worker
//
// A student's run scores them against every faculty member and alum, so
// students alone cover every pair. Users with a compute_matches job already
// queued are skipped, so it's safe to re-run.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";

import { assertTestIsolation, assertWriteAllowed } from "./lib/db-target.mjs";

type Row = Record<string, unknown>;

async function connect(url: string) {
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    return { query: async (t: string, p: unknown[] = []) => (await pool.query(t, p)).rows as Row[], close: () => pool.end() };
  }
  const sql = neon(url);
  return { query: (t: string, p: unknown[] = []) => sql.query(t, p) as Promise<Row[]>, close: async () => {} };
}

const PENDING = `
  SELECT u.id FROM users u
    JOIN onboarding_state o ON o.user_id = u.id AND o.current_step = 'done'
   WHERE u.deleted_at IS NULL AND u.role = 'student'
     AND NOT EXISTS (SELECT 1 FROM jobs j WHERE j.user_id = u.id AND j.type = 'compute_matches' AND j.status = 'queued')`;

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) config({ path: ".env.local", quiet: true });
  const { query, close } = await connect((apply ? assertWriteAllowed : assertTestIsolation)(process.env.DATABASE_URL));
  try {
    const [mentors] = await query(`
      SELECT count(*) FILTER (WHERE u.role = 'faculty')::int AS faculty, count(*) FILTER (WHERE u.role = 'alumni')::int AS alumni
        FROM users u JOIN onboarding_state o ON o.user_id = u.id AND o.current_step = 'done' WHERE u.deleted_at IS NULL`);
    const students = (await query(PENDING)).map((r) => String(r.id));
    console.log({ students: students.length, faculty: mentors.faculty, alumni: mentors.alumni });
    if (!apply) return console.log("Dry run. Re-run with --apply to queue the jobs.");

    for (const id of students) {
      await query(
        `INSERT INTO jobs (type, user_id, idempotency_key, payload) VALUES ('compute_matches', $1, $2, $3)
         ON CONFLICT (idempotency_key) DO NOTHING`,
        [id, `compute_matches:${id}:backfill:${randomUUID()}`, JSON.stringify({ trigger: "backfill" })],
      );
    }
    console.log(`Queued ${students.length} compute_matches jobs.`);

    const wake = process.env.WORKER_WAKE_URL;
    if (wake && students.length) {
      // A cold Render start can take a minute; the jobs are already safe in Postgres.
      const res = await fetch(wake, { signal: AbortSignal.timeout(90_000) }).catch((e: Error) => e);
      console.log(res instanceof Error ? `Worker wake-up failed (${res.name}); it drains the queue on its next start.` : `Worker woken (${res.status}).`);
    }
  } finally {
    await close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
