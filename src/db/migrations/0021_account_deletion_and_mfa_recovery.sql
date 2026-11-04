-- Durable account deletion and admin MFA recovery codes.
-- APPLY BEFORE deploying the code: deletion and MFA read these tables.
-- Additive except for the outbox foreign key. An integration.revoked row must outlive the
-- user it describes, or a deleted account's data would never be removed from linked apps.
-- account_deletions has no foreign key to users for the same reason.
CREATE TABLE IF NOT EXISTS "account_deletions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"requested_by" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_until" timestamp with time zone,
	"last_error" text,
	"files_deleted" integer DEFAULT 0 NOT NULL,
	"github_token_enc" bytea,
	"github_attempts" integer DEFAULT 0 NOT NULL,
	"github_outcome" text,
	"sweep_after" timestamp with time zone NOT NULL,
	"data_deleted_at" timestamp with time zone,
	"swept_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_deletions_due_idx" ON "account_deletions" ("next_attempt_at") WHERE "status" <> 'completed';--> statement-breakpoint
ALTER TABLE "webhook_outbox" DROP CONSTRAINT IF EXISTS "webhook_outbox_user_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "admin_mfa" ADD COLUMN IF NOT EXISTS "recovery_issued_at" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_mfa_recovery_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"code_hash" text NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "admin_mfa_recovery_codes_hash_key" ON "admin_mfa_recovery_codes" ("user_id", "code_hash");
