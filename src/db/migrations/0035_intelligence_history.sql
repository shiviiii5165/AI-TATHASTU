-- Career intelligence history (workstream A): one immutable row per changed assessment. The worker inserts a snapshot only
-- when the assessment summary changes (fingerprint), with a plain-language explanation of what changed and whether the
-- methodology (engine / framework version) changed. Rows are never updated (trigger below); they are deleted only with the
-- account (ON DELETE CASCADE), so account deletion keeps working.
-- Additive only. Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- Also: framework_reviews, the research-governance log (workstream D): reviewers' decisions on a framework version, a role
-- profile or an open research question. Insert-only too; a later decision supersedes an earlier one, nothing is edited.
-- Rollback: DROP TABLE framework_reviews; DROP TABLE intelligence_snapshots; DROP FUNCTION framework_reviews_immutable;
-- DROP FUNCTION intelligence_snapshots_immutable;
CREATE TABLE IF NOT EXISTS "intelligence_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"computed_at" timestamp with time zone NOT NULL,
	"engine_version" integer NOT NULL,
	"framework_version" text,
	"fingerprint" text NOT NULL,
	"trigger" text,
	"summary" jsonb NOT NULL,
	"changes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "intelligence_snapshots_user_idx" ON "intelligence_snapshots" USING btree ("user_id", "computed_at");
--> statement-breakpoint
ALTER TABLE "intelligence_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION intelligence_snapshots_immutable() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'intelligence_snapshots rows are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "intelligence_snapshots_no_update" ON "intelligence_snapshots";
--> statement-breakpoint
CREATE TRIGGER "intelligence_snapshots_no_update" BEFORE UPDATE ON "intelligence_snapshots" FOR EACH ROW EXECUTE FUNCTION intelligence_snapshots_immutable();

--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "framework_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"framework_version" text NOT NULL,
	"role" text,
	"question_id" text,
	"decision" text NOT NULL,
	"note" text NOT NULL,
	-- No foreign key on purpose: rows are immutable, so ON DELETE SET NULL would make deleting a reviewer's account fail.
	-- reviewer_email is the lasting record, as in admin_audit_logs.
	"reviewer_id" uuid,
	"reviewer_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "framework_reviews_decision_check" CHECK ("decision" IN ('approved', 'changes_requested', 'question_resolved', 'question_deferred'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "framework_reviews_version_idx" ON "framework_reviews" USING btree ("framework_version", "role", "created_at");
--> statement-breakpoint
ALTER TABLE "framework_reviews" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "framework_reviews_no_update" ON "framework_reviews";
--> statement-breakpoint
CREATE OR REPLACE FUNCTION framework_reviews_immutable() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'framework_reviews rows are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "framework_reviews_no_update" BEFORE UPDATE ON "framework_reviews" FOR EACH ROW EXECUTE FUNCTION framework_reviews_immutable();