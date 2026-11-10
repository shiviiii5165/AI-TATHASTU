-- GitHub contribution calendar, one snapshot per user, from GitHub's GraphQL API
-- (viewer.contributionsCollection), fetched during the GitHub connector sync.
--
-- A failed fetch only touches the last_error* columns, so the last successful snapshot
-- is never replaced by zeros. A row with synced_at NULL has never synced successfully:
-- its calendar is unavailable, which is not the same as zero contributions.
--
-- Additive and reversible: DROP TABLE github_contributions. No existing rows are touched.
-- The worker writes this table only when it exists, so it can ship before this runs.
CREATE TABLE IF NOT EXISTS "github_contributions" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- Calendar window GitHub reported (contributionsCollection.startedAt / endedAt).
  "range_start" timestamp with time zone,
  "range_end" timestamp with time zone,
  "total_contributions" integer CHECK ("total_contributions" >= 0),
  -- [{"date": "YYYY-MM-DD", "count": 3, "level": 0-4}, ...] oldest first, as GitHub returned it.
  "days" jsonb,
  -- {"commits", "pullRequests", "issues", "reviews", "repositories", "restricted"}
  "category_totals" jsonb,
  -- [{"name": "owner/repo", "commits": 12, "private": false}, ...] repositories GitHub named.
  "repositories" jsonb,
  -- Private contributions GitHub counted but would not name (the user's profile setting).
  "has_restricted_contributions" boolean,
  "github_login" text,
  "source" text NOT NULL DEFAULT 'github_graphql',
  "schema_version" integer NOT NULL DEFAULT 1,
  -- Last successful fetch; NULL until the first one succeeds.
  "synced_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_error" text,
  "last_error_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "github_contributions_snapshot_complete" CHECK (
    "synced_at" IS NULL
    OR ("total_contributions" IS NOT NULL AND "days" IS NOT NULL AND "category_totals" IS NOT NULL)
  )
);
