-- Operational monitoring: durable health-check history, an incident lifecycle, worker heartbeats and per-route
-- request outcomes. Additive only: four new tables, nothing existing changes. Safe to re-run (IF NOT EXISTS).
-- Rollback: DROP the four tables (no other table references them). Retention is enforced by the app
-- (health checks 14 days, route stats 30 days, resolved incidents 90 days).
CREATE TABLE IF NOT EXISTS "monitoring_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"component" text NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer,
	"summary" text NOT NULL,
	"monitor_version" integer DEFAULT 1 NOT NULL,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "monitoring_checks_component_idx" ON "monitoring_checks" USING btree ("component","checked_at");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitoring_incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"component" text NOT NULL,
	"severity" text NOT NULL,
	"state" text DEFAULT 'new' NOT NULL,
	"first_seen" timestamp with time zone NOT NULL,
	"last_seen" timestamp with time zone NOT NULL,
	"occurrences" integer DEFAULT 1 NOT NULL,
	"latest_error" text NOT NULL,
	"assigned_to_email" text,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"updated_by_email" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "monitoring_incidents_state_check" CHECK ("state" IN ('new', 'acknowledged', 'investigating', 'resolved', 'reopened'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "monitoring_incidents_fingerprint_key" ON "monitoring_incidents" USING btree ("fingerprint");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"version" text,
	"last_beat" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_by" timestamp with time zone,
	"active_jobs" integer DEFAULT 0 NOT NULL,
	"last_job_done_at" timestamp with time zone,
	"last_job_failed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "route_stats" (
	"route" text NOT NULL,
	"hour" timestamp with time zone NOT NULL,
	"ok" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"slow" integer DEFAULT 0 NOT NULL,
	"total_ms" bigint DEFAULT 0 NOT NULL,
	"last_error" text,
	"last_request_id" text,
	"last_failed_at" timestamp with time zone,
	CONSTRAINT "route_stats_route_hour_pk" PRIMARY KEY("route","hour")
);
