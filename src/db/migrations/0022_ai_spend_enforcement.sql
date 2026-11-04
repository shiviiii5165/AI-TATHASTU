-- AI spend accounting. APPLY BEFORE deploying the worker: with these tables missing it
-- fails closed, so every AI, Firecrawl and Apify call is refused and jobs fall back to rules.
-- Additive, apart from zeroing ai_cost_budgets.spent_usd: nothing ever wrote that column,
-- and its only value was an invented seed figure. Spend now comes from ai_spend_counters.
ALTER TABLE "ai_cost_budgets" ADD COLUMN IF NOT EXISTS "user_daily_usd" numeric(10, 2) DEFAULT '1.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_cost_budgets" ADD COLUMN IF NOT EXISTS "user_monthly_usd" numeric(10, 2) DEFAULT '5.00' NOT NULL;--> statement-breakpoint
UPDATE "ai_cost_budgets" SET "spent_usd" = 0;--> statement-breakpoint
INSERT INTO "ai_cost_budgets" ("period", "budget_usd")
SELECT 'monthly', '150.00' WHERE NOT EXISTS (SELECT 1 FROM "ai_cost_budgets");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_spend_counters" (
	"scope" text NOT NULL,
	"period" text NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
	"metered_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
	"estimated_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
	"reserved_usd" numeric(14, 6) DEFAULT 0 NOT NULL,
	PRIMARY KEY ("scope", "period")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_usage_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
	"job_id" uuid,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text DEFAULT 'reserved' NOT NULL,
	"reserved_usd" numeric(14, 6) NOT NULL,
	"cost_usd" numeric(14, 6),
	"tokens_in" integer,
	"tokens_out" integer,
	"day" text NOT NULL,
	"month" text NOT NULL,
	"scoped_to_user" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"settled_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_usage_ledger_open_idx" ON "ai_usage_ledger" ("expires_at") WHERE "status" = 'reserved';
