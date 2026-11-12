-- Source governance and health (research opportunity sources). FOR REVIEW: not yet executed anywhere.
--
-- Why: every source needs a recorded terms review with an explicit outcome, and only APPROVED sources may
-- be enabled. Until now "terms reviewed" was a single timestamp, which could not express "needs human
-- review" or "rejected" and allowed enabling on robots.txt evidence alone. Also records per-refresh counts
-- so the coverage report can show filtered (rejected) listings next to active and needs-review ones.
--
-- Idempotent and additive. Existing sources become 'needs_human_review' and are DISABLED: none had an
-- explicit approval recorded, so none may keep collecting until the owner approves it.
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "institution_type" text;
--> statement-breakpoint
-- Where the source's terms of use / copyright / website policy were looked for (null = none published).
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "terms_url" text;
--> statement-breakpoint
-- 'approved' | 'needs_human_review' | 'rejected'
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "terms_status" text NOT NULL DEFAULT 'needs_human_review';
--> statement-breakpoint
-- What the review found (quoted policy text, robots result, access result).
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "terms_evidence" text;
--> statement-breakpoint
-- Who approved it and when (owner action), for the audit trail.
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "approved_by" text;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
--> statement-breakpoint
-- Counts from the last successful refresh: entries seen, filtered as non-research, duplicates collapsed.
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "last_seen_count" integer;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "last_filtered_count" integer;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "last_duplicate_count" integer;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" DROP CONSTRAINT IF EXISTS "opportunity_sources_terms_status_check";
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD CONSTRAINT "opportunity_sources_terms_status_check" CHECK ("terms_status" IN ('approved', 'needs_human_review', 'rejected'));
--> statement-breakpoint
-- No source stays enabled without an explicit approval.
UPDATE "opportunity_sources" SET "enabled" = false WHERE "terms_status" <> 'approved' AND "enabled";
--> statement-breakpoint
ALTER TABLE "opportunity_sources" DROP CONSTRAINT IF EXISTS "opportunity_sources_enable_needs_approval";
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD CONSTRAINT "opportunity_sources_enable_needs_approval" CHECK (NOT "enabled" OR "terms_status" = 'approved');
