-- Lets an operator revoke JWT sessions: tokens carry this number, and bumping it kills them.
-- APPLY BEFORE deploying the code: the app selects this column on every users read.
-- Additive, with a constant default, so it needs no table rewrite and old code ignores it.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_version" integer DEFAULT 0 NOT NULL;
