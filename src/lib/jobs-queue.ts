import "server-only";

import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * Queues compute_intelligence unless one is already waiting (it will read the
 * latest data anyway). Only after onboarding: "Generate my profile" queues
 * the first run. Mirrors enqueue_compute_intelligence in worker/db.py.
 *
 * Past the limit it's postponed, not dropped: the data did change, so one job still has to
 * run, and while it waits later requests collapse into it. That caps recomputes at the
 * limit however they're triggered, and the profile still catches up.
 */
export async function enqueueComputeIntelligence(userId: string, trigger: string) {
  await db.execute(sql`
    INSERT INTO jobs (type, user_id, idempotency_key, payload, run_at)
    SELECT 'compute_intelligence', ${userId}, ${`compute_intelligence:${userId}:${randomUUID()}`}, ${JSON.stringify({ trigger })}::jsonb,
           now() + make_interval(secs => GREATEST(
             hit_sliding_limit(${`paid:recompute:${userId}`}::text, 30, 3600),
             hit_sliding_limit('paid_global:recompute', 5000, 3600)))
     WHERE EXISTS (SELECT 1 FROM onboarding_state WHERE user_id = ${userId} AND current_step = 'done')
       AND NOT EXISTS (SELECT 1 FROM jobs WHERE user_id = ${userId} AND type = 'compute_intelligence' AND status = 'queued')
    ON CONFLICT (idempotency_key) DO NOTHING`);
  wakeWorker(`compute_intelligence:${trigger}`);
}
