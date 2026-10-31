-- The worker's claim and lock-expiry queries run on every poll and filter running
-- jobs by lock expiry. Without this index they scan every job ever queued.
-- Additive and safe to apply before or after deploying the code. CREATE INDEX blocks
-- writes to jobs while it builds; if the table is large, create it by hand with
-- CREATE INDEX CONCURRENTLY first (IF NOT EXISTS then makes this a no-op).
CREATE INDEX IF NOT EXISTS "jobs_running_locked_until_idx" ON "jobs" USING btree ("locked_until") WHERE "jobs"."status" = 'running';
