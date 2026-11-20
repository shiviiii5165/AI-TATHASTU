-- AVSAR Collaborations: a team-building marketplace (posts, applications, memberships, enquiries, team threads,
-- in-app notifications, reports, moderation history and admin-granted faculty/alumni verification).
-- Additive only: new tables and functions, nothing existing changes. Safe to re-run (IF NOT EXISTS / OR REPLACE).
-- Every table has RLS enabled with no policies: the app connects as the table owner (which bypasses RLS), while
-- Supabase's anon/authenticated API roles can read nothing. All authorization happens in the app and in the
-- functions below.
-- Rollback: DROP FUNCTION collab_apply, collab_decide_application, collab_end_membership; then DROP TABLE
-- collab_reads, collab_messages, collab_threads, collab_notifications, collab_reports, collab_moderation_actions,
-- collab_blocks, collab_applications, collab_members, collab_posts, collab_creator_verifications (in that order).
CREATE TABLE IF NOT EXISTS "collab_creator_verifications" (
	"user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"note" text,
	"verified_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "collab_creator_verifications_kind_check" CHECK ("kind" IN ('faculty', 'alumni'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"creator_type" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"status_before_suspension" text,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"problem" text DEFAULT '' NOT NULL,
	"objectives" text DEFAULT '' NOT NULL,
	"outcome" text DEFAULT '' NOT NULL,
	"stage" text DEFAULT 'idea' NOT NULL,
	"roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"capacity" integer DEFAULT 1 NOT NULL,
	"experience" text DEFAULT '' NOT NULL,
	"commitment" text DEFAULT '' NOT NULL,
	"duration" text DEFAULT '' NOT NULL,
	"mode" text DEFAULT 'remote' NOT NULL,
	"location" text,
	"start_date" date,
	"deadline" date,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"content_hash" text,
	"search" tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, coalesce("title", '') || ' ' || coalesce("summary", '') || ' ' || coalesce("problem", ''))) STORED,
	"published_at" timestamp with time zone,
	"renewed_at" timestamp with time zone,
	"reminder_stage" integer DEFAULT 0 NOT NULL,
	"expired_at" timestamp with time zone,
	"owner_active_at" timestamp with time zone DEFAULT now() NOT NULL,
	"needs_owner_review" boolean DEFAULT false NOT NULL,
	"owner_review_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_posts_creator_type_check" CHECK ("creator_type" IN ('student', 'faculty', 'alumni', 'admin', 'community')),
	CONSTRAINT "collab_posts_category_check" CHECK ("category" IN ('project', 'hackathon', 'research', 'learning_group')),
	CONSTRAINT "collab_posts_status_check" CHECK ("status" IN ('draft', 'recruiting', 'paused', 'team_full', 'in_progress', 'completed', 'closed', 'expired', 'suspended')),
	CONSTRAINT "collab_posts_stage_check" CHECK ("stage" IN ('idea', 'planning', 'prototype', 'building', 'launched')),
	CONSTRAINT "collab_posts_mode_check" CHECK ("mode" IN ('remote', 'hybrid', 'in_person')),
	CONSTRAINT "collab_posts_capacity_check" CHECK ("capacity" BETWEEN 1 AND 50),
	CONSTRAINT "collab_posts_title_check" CHECK (char_length("title") BETWEEN 1 AND 120),
	CONSTRAINT "collab_posts_summary_check" CHECK (char_length("summary") <= 300)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_posts_discover_idx" ON "collab_posts" USING btree ("status", "category", "published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_posts_owner_idx" ON "collab_posts" USING btree ("owner_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_posts_skills_idx" ON "collab_posts" USING gin ("skills");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_posts_search_idx" ON "collab_posts" USING gin ("search");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_posts_review_idx" ON "collab_posts" USING btree ("needs_owner_review") WHERE "needs_owner_review";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "collab_posts"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"kind" text DEFAULT 'member' NOT NULL,
	"role" text,
	"status" text DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	CONSTRAINT "collab_members_kind_check" CHECK ("kind" IN ('owner', 'member')),
	CONSTRAINT "collab_members_status_check" CHECK ("status" IN ('active', 'left', 'removed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collab_members_active_key" ON "collab_members" USING btree ("post_id", "user_id") WHERE "status" = 'active';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_members_user_idx" ON "collab_members" USING btree ("user_id", "status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "collab_posts"("id") ON DELETE CASCADE,
	"applicant_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"role" text,
	"intro" text NOT NULL,
	"skills" text[] DEFAULT '{}'::text[] NOT NULL,
	"motivation" text NOT NULL,
	"links" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"decided_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_applications_status_check" CHECK ("status" IN ('pending', 'accepted', 'rejected', 'withdrawn'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collab_applications_pending_key" ON "collab_applications" USING btree ("post_id", "applicant_id") WHERE "status" = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_applications_post_idx" ON "collab_applications" USING btree ("post_id", "status", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_applications_applicant_idx" ON "collab_applications" USING btree ("applicant_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_blocks" (
	"owner_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"blocked_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_blocks_pk" PRIMARY KEY ("owner_id", "blocked_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL REFERENCES "collab_posts"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"enquirer_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
	"locked_at" timestamp with time zone,
	"last_message_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_threads_kind_check" CHECK (("kind" = 'team' AND "enquirer_id" IS NULL) OR ("kind" = 'enquiry' AND "enquirer_id" IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collab_threads_team_key" ON "collab_threads" USING btree ("post_id") WHERE "kind" = 'team';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collab_threads_enquiry_key" ON "collab_threads" USING btree ("post_id", "enquirer_id") WHERE "kind" = 'enquiry';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_threads_enquirer_idx" ON "collab_threads" USING btree ("enquirer_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL REFERENCES "collab_threads"("id") ON DELETE CASCADE,
	"sender_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"body" text NOT NULL,
	"hidden_at" timestamp with time zone,
	"hidden_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_messages_body_check" CHECK (char_length("body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_messages_thread_idx" ON "collab_messages" USING btree ("thread_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_reads" (
	"thread_id" uuid NOT NULL REFERENCES "collab_threads"("id") ON DELETE CASCADE,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_reads_pk" PRIMARY KEY ("thread_id", "user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"kind" text NOT NULL,
	"post_id" uuid REFERENCES "collab_posts"("id") ON DELETE CASCADE,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_notifications_user_idx" ON "collab_notifications" USING btree ("user_id", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"post_id" uuid REFERENCES "collab_posts"("id") ON DELETE CASCADE,
	"reason" text NOT NULL,
	"details" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"resolution" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collab_reports_target_check" CHECK ("target_type" IN ('post', 'message', 'thread')),
	CONSTRAINT "collab_reports_reason_check" CHECK ("reason" IN ('spam', 'fraud', 'harassment', 'inappropriate', 'other')),
	CONSTRAINT "collab_reports_status_check" CHECK ("status" IN ('open', 'actioned', 'dismissed'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "collab_reports_open_key" ON "collab_reports" USING btree ("reporter_id", "target_type", "target_id") WHERE "status" = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_reports_status_idx" ON "collab_reports" USING btree ("status", "created_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "collab_moderation_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid REFERENCES "collab_posts"("id") ON DELETE SET NULL,
	"actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"from_owner_id" uuid,
	"to_owner_id" uuid,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "collab_moderation_post_idx" ON "collab_moderation_actions" USING btree ("post_id", "created_at");
--> statement-breakpoint
ALTER TABLE "collab_creator_verifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_posts" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_members" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_applications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_blocks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_threads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_messages" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_reads" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_reports" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "collab_moderation_actions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Apply: one statement that checks every rule against the locked post, so a close, a suspension or a block can't
-- slip between the check and the insert. Returns the application id, or an error code prefixed with '!'.
CREATE OR REPLACE FUNCTION collab_apply(p_post uuid, p_user uuid, p_role text, p_intro text, p_skills text[], p_motivation text, p_links jsonb)
RETURNS text AS $$
DECLARE
	post record;
	new_id uuid;
BEGIN
	SELECT * INTO post FROM collab_posts WHERE id = p_post FOR UPDATE;
	IF NOT FOUND OR post.status = 'draft' THEN RETURN '!not_found'; END IF;
	IF post.owner_id = p_user THEN RETURN '!own_post'; END IF;
	IF post.status <> 'recruiting' THEN RETURN '!not_recruiting'; END IF;
	IF post.deadline IS NOT NULL AND post.deadline < current_date THEN RETURN '!deadline_passed'; END IF;
	IF EXISTS (SELECT 1 FROM collab_blocks WHERE owner_id = post.owner_id AND blocked_id = p_user) THEN RETURN '!blocked'; END IF;
	IF EXISTS (SELECT 1 FROM collab_members WHERE post_id = p_post AND user_id = p_user AND status = 'active') THEN RETURN '!already_member'; END IF;
	IF EXISTS (SELECT 1 FROM collab_applications WHERE post_id = p_post AND applicant_id = p_user AND status = 'pending') THEN RETURN '!duplicate'; END IF;
	IF (SELECT count(*) FROM collab_members WHERE post_id = p_post AND kind = 'member' AND status = 'active') >= post.capacity THEN RETURN '!full'; END IF;
	INSERT INTO collab_applications (post_id, applicant_id, role, intro, skills, motivation, links)
	VALUES (p_post, p_user, p_role, p_intro, coalesce(p_skills, '{}'), p_motivation, coalesce(p_links, '[]'::jsonb))
	RETURNING id INTO new_id;
	RETURN new_id::text;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Accept or reject, by the post's current owner only. Acceptance locks the post row, so concurrent acceptances are
-- serialised and the member count read here is exact: capacity can never be exceeded. Acceptance creates the
-- membership, the owner's membership and the team thread if missing, and marks the team full at capacity.
-- Returns 'accepted' | 'rejected' | '!not_found' | '!forbidden' | '!not_pending' | '!not_recruiting' | '!full'.
CREATE OR REPLACE FUNCTION collab_decide_application(p_app uuid, p_actor uuid, p_accept boolean)
RETURNS text AS $$
DECLARE
	app record;
	post record;
	members integer;
BEGIN
	SELECT * INTO app FROM collab_applications WHERE id = p_app;
	IF NOT FOUND THEN RETURN '!not_found'; END IF;
	SELECT * INTO post FROM collab_posts WHERE id = app.post_id FOR UPDATE;
	IF post.owner_id IS DISTINCT FROM p_actor THEN RETURN '!forbidden'; END IF;
	-- Re-read under the post lock: a withdrawal or another decision may have landed meanwhile.
	SELECT * INTO app FROM collab_applications WHERE id = p_app FOR UPDATE;
	IF app.status <> 'pending' THEN RETURN '!not_pending'; END IF;
	IF NOT p_accept THEN
		UPDATE collab_applications SET status = 'rejected', decided_by = p_actor, decided_at = now() WHERE id = p_app;
		UPDATE collab_posts SET owner_active_at = now() WHERE id = post.id;
		RETURN 'rejected';
	END IF;
	IF post.status NOT IN ('recruiting', 'paused') THEN RETURN '!not_recruiting'; END IF;
	SELECT count(*) INTO members FROM collab_members WHERE post_id = post.id AND kind = 'member' AND status = 'active';
	IF members >= post.capacity THEN RETURN '!full'; END IF;
	UPDATE collab_applications SET status = 'accepted', decided_by = p_actor, decided_at = now() WHERE id = p_app;
	INSERT INTO collab_members (post_id, user_id, kind, role) VALUES (post.id, app.applicant_id, 'member', app.role)
	ON CONFLICT DO NOTHING;
	INSERT INTO collab_members (post_id, user_id, kind) VALUES (post.id, p_actor, 'owner') ON CONFLICT DO NOTHING;
	INSERT INTO collab_threads (post_id, kind) VALUES (post.id, 'team') ON CONFLICT DO NOTHING;
	UPDATE collab_posts SET
		status = CASE WHEN members + 1 >= capacity AND status = 'recruiting' THEN 'team_full' ELSE status END,
		owner_active_at = now(), updated_at = now()
	WHERE id = post.id;
	RETURN 'accepted';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- Ends an active (non-owner) membership: the member leaving (p_actor = member) or the owner removing them.
-- A full team reopens to recruiting. Returns 'left' | 'removed' | '!not_found' | '!forbidden'.
CREATE OR REPLACE FUNCTION collab_end_membership(p_post uuid, p_member uuid, p_actor uuid)
RETURNS text AS $$
DECLARE
	post record;
	result text;
BEGIN
	SELECT * INTO post FROM collab_posts WHERE id = p_post FOR UPDATE;
	IF NOT FOUND THEN RETURN '!not_found'; END IF;
	IF p_actor = p_member THEN result := 'left';
	ELSIF post.owner_id = p_actor THEN result := 'removed';
	ELSE RETURN '!forbidden';
	END IF;
	UPDATE collab_members SET status = result, ended_at = now(), ended_by = p_actor
	WHERE post_id = p_post AND user_id = p_member AND kind = 'member' AND status = 'active';
	IF NOT FOUND THEN RETURN '!not_found'; END IF;
	UPDATE collab_posts SET status = CASE WHEN status = 'team_full' THEN 'recruiting' ELSE status END, updated_at = now()
	WHERE id = p_post;
	RETURN result;
END;
$$ LANGUAGE plpgsql;
