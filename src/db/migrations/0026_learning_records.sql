-- Courses and certifications as their own records, so the engine can tell apart:
--   a certification named on a resume (claimed)      -> stays a profile_fact; never adds proficiency
--   a certification checked against its issuer       -> kind='certification', verification='verified' (+5, supporting only)
--   a recommended / started / completed course       -> kind='course', status=...; completion is learning, never proficiency
-- Additive and reversible (DROP TABLE learning_records); no existing rows are touched or moved.
-- The worker reads this table only when it exists (compute.load_learning_records), so it can ship before this runs.
CREATE TABLE IF NOT EXISTS "learning_records" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" IN ('course', 'certification')),
  "title" text NOT NULL,
  "provider" text,
  "url" text,
  -- learning_resources row when the course is from the verified catalogue
  "resource_id" uuid,
  "status" text NOT NULL DEFAULT 'recommended' CHECK ("status" IN ('recommended', 'started', 'completed', 'claimed')),
  "verification" text NOT NULL DEFAULT 'unverified' CHECK ("verification" IN ('unverified', 'verified', 'rejected')),
  -- where the record came from: 'user_entered', 'resume', 'roadmap', or an issuer integration
  "source" text NOT NULL,
  -- the profile_fact it mirrors, when it came from a resume
  "source_fact_id" uuid,
  "credential_id" text,
  "skills" text[] NOT NULL DEFAULT '{}',
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "verified_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "learning_records_user_kind_title_unique" ON "learning_records" ("user_id", "kind", lower("title")) WHERE "deleted_at" IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "learning_records_user_idx" ON "learning_records" ("user_id");
