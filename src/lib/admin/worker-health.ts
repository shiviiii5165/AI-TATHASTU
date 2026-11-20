import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

const missingTable = (e: unknown) => /relation .* does not exist|42P01/i.test(String((e as { message?: string })?.message ?? e) + String((e as { code?: string })?.code ?? ""));

// ── Worker heartbeats ────────────────────────────────────────────────────────

/** An awake worker that hasn't reported within this long is treated as stalled. */
export const HEARTBEAT_STALE_MS = 3 * 60_000;
/** A sleeping worker may report this long after its stated wake time before it counts as missing. */
export const WAKE_GRACE_MS = 5 * 60_000;

export interface WorkerBeat { workerId: string; state: string; version: string | null; lastBeat: string; expectedBy: string | null; activeJobs: number; lastJobDoneAt: string | null; lastJobFailedAt: string | null }

/** The status a worker's latest heartbeat supports. Pure, for tests. */
export function workerStatus(beats: WorkerBeat[], now = Date.now()): { status: "healthy" | "critical" | "unknown"; summary: string } {
  if (beats.length === 0) return { status: "unknown", summary: "No heartbeat has been recorded. Needs migration 0033 and the updated worker deployed." };
  const fresh = beats.filter((b) => {
    if (b.state === "sleeping") return now <= new Date(b.expectedBy ?? b.lastBeat).getTime() + WAKE_GRACE_MS;
    return now - new Date(b.lastBeat).getTime() <= HEARTBEAT_STALE_MS;
  });
  if (fresh.length === 0) {
    const last = beats.map((b) => b.lastBeat).sort().at(-1)!;
    return { status: "critical", summary: `No worker has reported since ${new Date(last).toISOString()}: it may be down.` };
  }
  const sleeping = fresh.every((b) => b.state === "sleeping");
  return { status: "healthy", summary: sleeping ? "Idle and sleeping to let the database suspend; it wakes for new jobs." : `${fresh.length} worker thread(s) reporting.` };
}

export async function workerBeats(): Promise<{ available: boolean; beats: WorkerBeat[] }> {
  try {
    const { rows } = await db.execute(sql`
      SELECT worker_id, state, version, last_beat, expected_by, active_jobs, last_job_done_at, last_job_failed_at
        FROM worker_heartbeats WHERE last_beat > now() - interval '7 days' ORDER BY last_beat DESC LIMIT 50`);
    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
    return {
      available: true,
      beats: (rows as Record<string, unknown>[]).map((r) => ({
        workerId: String(r.worker_id), state: String(r.state), version: (r.version as string) ?? null, lastBeat: iso(r.last_beat)!, expectedBy: iso(r.expected_by),
        activeJobs: Number(r.active_jobs ?? 0), lastJobDoneAt: iso(r.last_job_done_at), lastJobFailedAt: iso(r.last_job_failed_at),
      })),
    };
  } catch (e) {
    if (missingTable(e)) return { available: false, beats: [] };
    throw e;
  }
}

