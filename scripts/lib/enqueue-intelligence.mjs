// Who needs a recompute, and queuing it. The worker's compute_intelligence job is the only
// thing that writes intelligence; this file must only ever insert into `jobs`.

// Finished onboarding, not deleted, and not already waiting or running.
export const PENDING_SQL = `
  SELECT u.id FROM users u
    JOIN onboarding_state o ON o.user_id = u.id AND o.current_step = 'done'
   WHERE u.deleted_at IS NULL
     AND NOT EXISTS (SELECT 1 FROM jobs j
                      WHERE j.user_id = u.id AND j.type = 'compute_intelligence' AND j.status IN ('queued', 'running'))
   ORDER BY u.created_at`;

export const ENQUEUE_SQL = `
  INSERT INTO jobs (type, user_id, idempotency_key, payload)
  VALUES ('compute_intelligence', $1, $2, $3)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id`;

/**
 * `query(text, params)` returns rows. Dry run unless `apply`. The key is fixed per user and
 * `batch`, so re-running a batch queues nothing twice.
 */
export const keyFor = (id, batch) => `compute_intelligence:${id}:backfill:${batch}`;

// How many of these users already have a job for this batch: re-applying the same batch queues them nowhere.
export const ALREADY_SQL = `SELECT count(*)::int AS n FROM jobs WHERE idempotency_key = ANY($1::text[])`;

export async function enqueueIntelligence(query, { apply = false, batch = "engine-v1" } = {}) {
  const pending = (await query(PENDING_SQL, [])).map((row) => String(row.id));
  if (!apply) {
    // A dry run says what --apply would really do, not just who is eligible.
    const already = pending.length ? Number((await query(ALREADY_SQL, [pending.map((id) => keyFor(id, batch))]))[0]?.n ?? 0) : 0;
    return { pending: pending.length, queued: 0, alreadyInBatch: already, wouldQueue: pending.length - already };
  }

  let queued = 0;
  for (const id of pending) {
    const rows = await query(ENQUEUE_SQL, [id, keyFor(id, batch), JSON.stringify({ trigger: `backfill:${batch}` })]);
    queued += rows.length;
  }
  return { pending: pending.length, queued };
}
