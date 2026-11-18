-- Student Intelligence (admin rankings). Additive only: three new tables, no change to any existing table.
CREATE TABLE IF NOT EXISTS "intelligence_ranking_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"definition" jsonb NOT NULL,
	"published_version" integer DEFAULT 0 NOT NULL,
	"created_by_email" text NOT NULL,
	"updated_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intelligence_ranking_profiles_status_idx" ON "intelligence_ranking_profiles" USING btree ("status","updated_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intelligence_ranking_versions" (
	"profile_id" uuid NOT NULL REFERENCES "intelligence_ranking_profiles"("id") ON DELETE cascade,
	"version" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"published_by_email" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intelligence_ranking_versions_profile_id_version_pk" PRIMARY KEY("profile_id","version")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intelligence_ranking_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL REFERENCES "intelligence_ranking_profiles"("id") ON DELETE cascade,
	"version" integer NOT NULL,
	"cohort" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cohort_key" text NOT NULL,
	"ranked_count" integer NOT NULL,
	"ineligible_count" integer NOT NULL,
	"results" jsonb NOT NULL,
	"computed_by_email" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intelligence_ranking_snapshots_lookup_idx" ON "intelligence_ranking_snapshots" USING btree ("profile_id","version","cohort_key","computed_at");
