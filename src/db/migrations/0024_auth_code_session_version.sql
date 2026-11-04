-- Binds an integration authorization code to the session version that approved it, so a
-- code issued just before a revocation can't be exchanged after it. APPLY BEFORE deploying:
-- the token route reads this column. Nullable and additive, so old code ignores it, and a
-- code issued by old code during the rollout (they live 60 seconds) still works.
ALTER TABLE "integration_auth_codes" ADD COLUMN IF NOT EXISTS "session_version" integer;
