-- Sliding limits for paid work, and call data for the provider page. APPLY BEFORE deploying:
-- web and worker call hit_sliding_limit when queueing a recompute, so without it those
-- writes fail. Additive; old code ignores all of it.
ALTER TABLE "rate_limits" ADD COLUMN IF NOT EXISTS "buckets" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD COLUMN IF NOT EXISTS "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "ai_usage_ledger" ADD COLUMN IF NOT EXISTS "error_kind" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_ledger_month_idx" ON "ai_usage_ledger" ("month", "provider");--> statement-breakpoint
-- Returns 0 and counts the hit, or returns the seconds until one is allowed. Refused hits
-- aren't counted, so hammering a limit doesn't extend it. A bucket keeps counting until its
-- END is a full window old, which errs late but guarantees no span of p_window seconds ever
-- holds more than p_limit, at any boundary. The row lock serialises callers per key.
CREATE OR REPLACE FUNCTION hit_sliding_limit(p_key text, p_limit integer, p_window integer, p_now bigint DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  bucket_s integer := greatest(p_window / 12, 1);
  now_s bigint := coalesce(p_now, extract(epoch FROM clock_timestamp())::bigint);
  current_bucket bigint := now_s - now_s % bucket_s;
  kept jsonb;
  total integer;
  oldest bigint;
BEGIN
  INSERT INTO rate_limits (key, window_start, count) VALUES (p_key, now(), 0) ON CONFLICT (key) DO NOTHING;
  SELECT buckets INTO kept FROM rate_limits WHERE key = p_key FOR UPDATE;
  SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb), coalesce(sum(v::integer), 0), min(k::bigint)
    INTO kept, total, oldest
    FROM jsonb_each_text(kept) AS e(k, v)
   WHERE k::bigint + bucket_s > now_s - p_window;
  IF total >= p_limit THEN
    UPDATE rate_limits SET buckets = kept, count = total, window_start = now() WHERE key = p_key;
    RETURN greatest(oldest + bucket_s + p_window - now_s, 1);
  END IF;
  kept := kept || jsonb_build_object(current_bucket::text, coalesce((kept ->> current_bucket::text)::integer, 0) + 1);
  UPDATE rate_limits SET buckets = kept, count = total + 1, window_start = now() WHERE key = p_key;
  RETURN 0;
END;
$$ LANGUAGE plpgsql;
