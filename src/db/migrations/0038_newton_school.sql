-- Adds Newton School of Technology (missing from 0037). Idempotent upsert.
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Newton School of Technology', ARRAY['NST', 'Newton School', 'Newton']::text[], 'other', 'Sonipat', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
