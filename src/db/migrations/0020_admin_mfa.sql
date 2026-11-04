-- Authenticator-app secrets for operators, sealed with CONNECTOR_TOKEN_KEY.
-- A new table: safe to apply before or after deploying the code, as long as
-- ADMIN_MFA_REQUIRED stays unset until it exists and operators have enrolled.
CREATE TABLE IF NOT EXISTS "admin_mfa" (
	"user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
	"secret_enc" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"last_counter" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
