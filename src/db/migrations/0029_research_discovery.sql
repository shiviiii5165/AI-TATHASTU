-- Research opportunity discovery, details, application handling and saved opportunities.
--
-- Idempotent and additive: safe whether or not an amended 0028 already added some of these columns.
-- No row is updated or deleted.
--
-- 1. Source scheduling and page monitoring (opportunity_sources).
-- 2. Extracted announcement details with evidence, and source-aware application handling (opportunities).
-- 3. Saved opportunities with opt-in deadline reminders, and the student's own interactions
--    (viewed / opened the official application / told us they applied). AI Tathastu never records an
--    external submission it cannot verify.
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "adapter" text;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "include_pattern" text;
--> statement-breakpoint
-- True only when the source lists every open position (absence then means removed).
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "withdraw_on_absence" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "consecutive_failures" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "next_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "locked_until" timestamp with time zone;
--> statement-breakpoint
-- Where the source's positions are (copied onto its listings for the International filter).
ALTER TABLE "opportunity_sources" ADD COLUMN IF NOT EXISTS "country" text;
--> statement-breakpoint
ALTER TABLE "opportunity_sources" DROP CONSTRAINT IF EXISTS "opportunity_sources_kind_check";
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD CONSTRAINT "opportunity_sources_kind_check" CHECK ("kind" IN ('rss', 'json_feed', 'page_monitor', 'manual'));
--> statement-breakpoint
ALTER TABLE "opportunity_sources" DROP CONSTRAINT IF EXISTS "opportunity_sources_monitor_needs_adapter";
--> statement-breakpoint
ALTER TABLE "opportunity_sources" ADD CONSTRAINT "opportunity_sources_monitor_needs_adapter" CHECK ("kind" <> 'page_monitor' OR "adapter" IS NOT NULL);
--> statement-breakpoint
-- Department / lab as the source states it.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "research_group" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "link_checked_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "link_status" integer;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "country" text;
--> statement-breakpoint
-- Fields read from the official announcement (PDF or page), each as {"value": ..., "evidence": "<exact quote>"}.
-- A field the announcement does not state is absent, never guessed.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "details" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
-- 'pending' | 'extracted' | 'not_available' (no readable document) | 'failed'
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "extraction_status" text NOT NULL DEFAULT 'pending';
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "extracted_at" timestamp with time zone;
--> statement-breakpoint
-- How a student applies, only from what the source publishes:
-- 'portal' (official application link) | 'announcement' (follow the official announcement's instructions)
-- | 'email' (an address published in the announcement) | 'unavailable' (no verified destination: no Apply button).
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "application_method" text NOT NULL DEFAULT 'announcement';
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "application_url" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "application_email" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunity_saves" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  -- Explicit opt-in to one deadline reminder by email.
  "remind" boolean NOT NULL DEFAULT false,
  "reminded_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "opportunity_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunity_interactions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "opportunity_id" uuid NOT NULL REFERENCES "opportunities"("id") ON DELETE CASCADE,
  -- 'viewed' (opened the detail page) | 'opened_application' (clicked through to the official destination)
  -- | 'confirmed_applied' (the student told us they applied; never verified by AI Tathastu)
  "kind" text NOT NULL CHECK ("kind" IN ('viewed', 'opened_application', 'confirmed_applied')),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunity_interactions_user_idx" ON "opportunity_interactions" ("user_id", "opportunity_id", "kind");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_extraction_idx" ON "opportunities" ("extraction_status") WHERE "extraction_status" = 'pending';
