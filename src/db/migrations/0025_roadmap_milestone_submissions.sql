-- Evidence a user submits for a career-roadmap milestone. A submission is a claim awaiting review:
-- a milestone only counts as completed when the intelligence engine finds the skill at its expected
-- level from the user's evidence. Additive and reversible (DROP TABLE), no existing rows touched.
CREATE TABLE IF NOT EXISTS "roadmap_milestone_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "milestone_id" text NOT NULL,
  "role" text NOT NULL,
  "skill" text NOT NULL,
  "evidence_url" text NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roadmap_milestone_submissions_unique" ON "roadmap_milestone_submissions" ("user_id", "milestone_id", "evidence_url");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "roadmap_milestone_submissions_user_idx" ON "roadmap_milestone_submissions" ("user_id");
