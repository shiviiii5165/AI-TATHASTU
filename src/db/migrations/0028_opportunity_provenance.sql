-- Opportunity provenance and lifecycle (research opportunities pipeline).
--
-- 1. opportunity_sources: the curated registry of official sources an operator approved.
--    Nothing is fetched from a source that is not registered and enabled here.
-- 2. opportunities gains provenance (source, external id, canonical URL, publication and
--    verification timestamps) and a lifecycle status. Only status = 'active' rows with a
--    recent verification are ever recommended.
-- 3. The six rows seeded by 0014 were fabricated (no real source, placeholder URLs such as
--    '/opportunities', relative deadlines such as '10 days left'). They are kept for audit but
--    marked status = 'unverified', origin = 'legacy_seed', so they can never be shown.
--
-- Additive and reversible (drop the new columns / table). No row is deleted.
CREATE TABLE IF NOT EXISTS "opportunity_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  -- 'rss' | 'json_feed' (fetched by the refresh job) | 'manual' (operator-curated entries only)
  "kind" text NOT NULL CHECK ("kind" IN ('rss', 'json_feed', 'manual')),
  -- The official page or feed URL. Required for fetched kinds.
  "url" text,
  -- Owning institution or organisation, shown as provenance.
  "organization" text NOT NULL,
  -- Operator's record of the source's terms / robots review, required before enabling a fetched source.
  "terms_reviewed_at" timestamp with time zone,
  "terms_note" text,
  -- Feed entries become 'active' only when the operator trusts the source to publish vacancies;
  -- otherwise they wait in 'unverified' for review.
  "auto_verify" boolean NOT NULL DEFAULT false,
  "enabled" boolean NOT NULL DEFAULT false,
  "min_fetch_interval_minutes" integer NOT NULL DEFAULT 360 CHECK ("min_fetch_interval_minutes" >= 60),
  "last_fetched_at" timestamp with time zone,
  "last_success_at" timestamp with time zone,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "opportunity_sources_fetch_needs_url" CHECK ("kind" = 'manual' OR "url" IS NOT NULL),
  CONSTRAINT "opportunity_sources_enable_needs_review" CHECK (NOT "enabled" OR "kind" = 'manual' OR "terms_reviewed_at" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "source_id" text REFERENCES "opportunity_sources"("id");
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "external_id" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "canonical_url" text;
--> statement-breakpoint
-- 'curated' (operator entry) | 'feed' (refresh job) | 'legacy_seed' (0014, fabricated)
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'curated';
--> statement-breakpoint
-- 'active' | 'expired' | 'withdrawn' | 'unverified'
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'unverified';
--> statement-breakpoint
-- research_assistant | research_project | research_internship | collaboration | funded_programme | call_for_collaborators
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "kind" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "work_mode" text;
--> statement-breakpoint
-- Eligibility exactly as published; never paraphrased into a rule.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "eligibility" text;
--> statement-breakpoint
-- Structured study levels the listing explicitly restricts to (e.g. {'undergraduate'}); empty = not stated.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "eligible_levels" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
-- Parsed deadline, only when the source published an exact date. The text "deadline" column stays as published.
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "deadline_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "published_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "last_verified_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "status_reason" text;
--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_source_external_uq" ON "opportunities" ("source_id", "external_id") WHERE "external_id" IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opportunities_canonical_url_uq" ON "opportunities" ("canonical_url") WHERE "canonical_url" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opportunities_status_idx" ON "opportunities" ("status", "type");
--> statement-breakpoint
UPDATE "opportunities"
SET "origin" = 'legacy_seed', "status" = 'unverified', "status_reason" = 'Fabricated seed data from migration 0014: no real source'
WHERE "source_id" IS NULL AND ("url" IS NULL OR "url" LIKE '/%');
