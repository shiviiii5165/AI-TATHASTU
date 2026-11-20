-- Cross-app profile sync (Collaborate, Avsar): consent provenance, an insert-only consent history, the receiver's
-- answer on every webhook row, and one sync status per user and app.
-- Additive only. Safe to re-run (IF NOT EXISTS / OR REPLACE). Apply by hand like 0025-0035 (do not run drizzle migrate).
-- Rollback: DROP TABLE integration_sync_state; DROP TABLE integration_consent_log; DROP FUNCTION integration_consent_log_immutable;
-- ALTER TABLE webhook_outbox DROP COLUMN outcome, DROP COLUMN last_attempt_at, DROP COLUMN payload_version;
-- ALTER TABLE integration_consents DROP COLUMN source, DROP COLUMN policy_version;

-- Where the current consent came from: 'user' (settings or the app's approval screen), 'auto_provision' (the default
-- sharing set at signup), 'backfill' (an operator-run backfill). policy_version is the sharing policy it was given under.
ALTER TABLE "integration_consents" ADD COLUMN IF NOT EXISTS "source" text;
--> statement-breakpoint
ALTER TABLE "integration_consents" ADD COLUMN IF NOT EXISTS "policy_version" integer;

--> statement-breakpoint
-- Every consent change, never edited: what was shared with which app, linked or not, from what source, under which policy.
-- Deleted with the account (ON DELETE CASCADE) so account deletion keeps working.
CREATE TABLE IF NOT EXISTS "integration_consent_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"client_id" text NOT NULL,
	"scopes" jsonb NOT NULL,
	"linked" boolean NOT NULL,
	"source" text NOT NULL,
	"policy_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_consent_log_user_idx" ON "integration_consent_log" USING btree ("user_id", "client_id", "created_at");
--> statement-breakpoint
ALTER TABLE "integration_consent_log" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION integration_consent_log_immutable() RETURNS trigger AS $$
BEGIN
	RAISE EXCEPTION 'integration_consent_log rows are immutable';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DROP TRIGGER IF EXISTS "integration_consent_log_no_update" ON "integration_consent_log";
--> statement-breakpoint
CREATE TRIGGER "integration_consent_log_no_update" BEFORE UPDATE ON "integration_consent_log" FOR EACH ROW EXECUTE FUNCTION integration_consent_log_immutable();

--> statement-breakpoint
-- What the receiving app said it did with the event (created, updated, conflict, ...), not just that it answered 2xx.
ALTER TABLE "webhook_outbox" ADD COLUMN IF NOT EXISTS "outcome" text;
--> statement-breakpoint
ALTER TABLE "webhook_outbox" ADD COLUMN IF NOT EXISTS "last_attempt_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "webhook_outbox" ADD COLUMN IF NOT EXISTS "payload_version" integer DEFAULT 1 NOT NULL;

--> statement-breakpoint
-- One row per user and app: the state the user and admins see. No foreign key on purpose: the deletion status must
-- outlive the deleted account it describes (it holds only the id). Written by the webhook dispatcher only.
CREATE TABLE IF NOT EXISTS "integration_sync_state" (
	"user_id" uuid NOT NULL,
	"client_id" text NOT NULL,
	"status" text NOT NULL,
	"last_outcome" text,
	"last_event" text,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "integration_sync_state_pk" PRIMARY KEY ("user_id", "client_id"),
	CONSTRAINT "integration_sync_state_status_check" CHECK ("status" IN ('pending', 'synced', 'missing', 'conflict', 'review', 'failed', 'declined', 'unlinked', 'deleted'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "integration_sync_state_status_idx" ON "integration_sync_state" USING btree ("client_id", "status");
--> statement-breakpoint
ALTER TABLE "integration_sync_state" ENABLE ROW LEVEL SECURITY;
