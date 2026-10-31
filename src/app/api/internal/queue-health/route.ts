import { sql } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { db } from "@/db";
import { guarded } from "@/lib/api-guard";
import { isCronCall } from "@/lib/internal-auth";

// Alert when: work has waited this long (worker down or overwhelmed)...
const MAX_QUEUE_AGE_SECONDS = 15 * 60;
// ...or a job has outlived its lock (worker died and nothing reclaimed it)...
const MAX_EXPIRED_RUNNING = 0;
// ...or this many jobs ran out of attempts in the last hour.
const MAX_FAILED_LAST_HOUR = 25;

/**
 * Queue state for an uptime monitor (Bearer CRON_SECRET or INTERNAL_API_SECRET):
 * 200 while healthy, 503 with the reasons otherwise. Counts only, no user data.
 * A `failed` job is the dead letter: it stays in `jobs` with its last_error.
 */
export const GET = guarded(async (request: Request) => {
  await connection();
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { rows } = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM jobs WHERE status = 'queued' AND run_at <= now()) AS queued,
      (SELECT coalesce(extract(epoch FROM now() - min(run_at)), 0)::int FROM jobs WHERE status = 'queued' AND run_at <= now()) AS oldest_queued_seconds,
      (SELECT count(*)::int FROM jobs WHERE status = 'running' AND locked_until >= now()) AS running,
      (SELECT count(*)::int FROM jobs WHERE status = 'running' AND locked_until < now() - interval '5 minutes') AS expired_running,
      (SELECT count(*)::int FROM jobs WHERE status = 'failed' AND finished_at > now() - interval '1 hour') AS failed_last_hour`);
  const health = rows[0] as { queued: number; oldest_queued_seconds: number; running: number; expired_running: number; failed_last_hour: number };

  const alerts = [
    health.oldest_queued_seconds > MAX_QUEUE_AGE_SECONDS && "queue_age",
    health.expired_running > MAX_EXPIRED_RUNNING && "stuck_jobs",
    health.failed_last_hour > MAX_FAILED_LAST_HOUR && "failures",
  ].filter(Boolean);
  return NextResponse.json({ ...health, alerts }, { status: alerts.length ? 503 : 200, headers: { "Cache-Control": "no-store" } });
});
