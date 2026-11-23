-- Generated from src/db/seeds/institutions-directory.ts (extended directory, 2026-11-23). Idempotent upsert.
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Punjab Engineering College', '{}'::text[], 'deemed_university', 'Chandigarh', 'Chandigarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Guru Gobind Singh Indraprastha University', '{}'::text[], 'state_university', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jaypee Institute of Information Technology', '{}'::text[], 'deemed_university', 'Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Galgotias University', '{}'::text[], 'private_university', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sharda University', '{}'::text[], 'private_university', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bennett University', '{}'::text[], 'private_university', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Lucknow', '{}'::text[], 'state_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('King George''s Medical University', '{}'::text[], 'state_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Motilal Nehru National Institute of Technology', '{}'::text[], 'nit', 'Prayagraj', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Harcourt Butler Technical University', '{}'::text[], 'state_university', 'Kanpur', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Graphic Era University', '{}'::text[], 'deemed_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('UPES', '{}'::text[], 'private_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('DIT University', '{}'::text[], 'private_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Kashmir', '{}'::text[], 'state_university', 'Srinagar', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shri Mata Vaishno Devi University', '{}'::text[], 'state_university', 'Katra', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('College of Engineering Pune', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('VIT Pune', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('MIT World Peace University', '{}'::text[], 'private_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bharati Vidyapeeth', '{}'::text[], 'deemed_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('K. J. Somaiya Institute of Technology', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tata Institute of Social Sciences', '{}'::text[], 'deemed_university', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Institute of Chemical Technology', '{}'::text[], 'deemed_university', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Nirma University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gujarat University', '{}'::text[], 'state_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ahmedabad University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Pandit Deendayal Energy University', '{}'::text[], 'private_university', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sardar Vallabhbhai National Institute of Technology', '{}'::text[], 'nit', 'Surat', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharaja Sayajirao University of Baroda', '{}'::text[], 'state_university', 'Vadodara', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Marwadi University', '{}'::text[], 'private_university', 'Rajkot', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Rajasthan', '{}'::text[], 'state_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Manipal University Jaipur', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('The LNM Institute of Information Technology', '{}'::text[], 'deemed_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Kota', '{}'::text[], 'state_university', 'Kota', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mohanlal Sukhadia University', '{}'::text[], 'state_university', 'Udaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Barkatullah University', '{}'::text[], 'state_university', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajiv Gandhi Proudyogiki Vishwavidyalaya', '{}'::text[], 'state_university', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Devi Ahilya Vishwavidyalaya', '{}'::text[], 'state_university', 'Indore', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jabalpur Engineering College', '{}'::text[], 'other', 'Jabalpur', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Visvesvaraya Technological University', '{}'::text[], 'state_university', 'Belagavi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('PES University', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('RV College of Engineering', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('BMS College of Engineering', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NITTE University', '{}'::text[], 'deemed_university', 'Mangaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Christ University', '{}'::text[], 'deemed_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jain University', '{}'::text[], 'deemed_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Osmania University', '{}'::text[], 'state_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mahindra University', '{}'::text[], 'private_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jawaharlal Nehru Technological University Hyderabad', '{}'::text[], 'state_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kakatiya University', '{}'::text[], 'state_university', 'Warangal', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Andhra University', '{}'::text[], 'state_university', 'Visakhapatnam', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('GITAM Deemed University', '{}'::text[], 'deemed_university', 'Visakhapatnam', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KL University', '{}'::text[], 'deemed_university', 'Vaddeswaram', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vignan''s Foundation for Science, Technology and Research', '{}'::text[], 'deemed_university', 'Guntur', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sri Venkateswara University', '{}'::text[], 'state_university', 'Tirupati', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('VIT-AP University', '{}'::text[], 'private_university', 'Amaravati', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SRM University AP', '{}'::text[], 'private_university', 'Amaravati', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Madras', '{}'::text[], 'state_university', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SASTRA Deemed University', '{}'::text[], 'deemed_university', 'Thanjavur', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Techno India University', '{}'::text[], 'private_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Siksha ''O'' Anusandhan', '{}'::text[], 'deemed_university', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Utkal University', '{}'::text[], 'state_university', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gauhati University', '{}'::text[], 'state_university', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tezpur University', '{}'::text[], 'central_university', 'Tezpur', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Roorkee Institute of Technology', '{}'::text[], 'other', 'Roorkee', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Uttarakhand', '{}'::text[], 'nit', 'Srinagar (Garhwal)', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kumaun University', '{}'::text[], 'state_university', 'Nainital', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hemvati Nandan Bahuguna Garhwal University', '{}'::text[], 'central_university', 'Srinagar (Garhwal)', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Uttarakhand Technical University', '{}'::text[], 'state_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Doon University', '{}'::text[], 'state_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Uttaranchal University', '{}'::text[], 'private_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sardar Bhagwan Singh University', '{}'::text[], 'private_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dev Sanskriti Vishwavidyalaya', '{}'::text[], 'private_university', 'Haridwar', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jaypee University of Information Technology', '{}'::text[], 'private_university', 'Waknaghat', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shoolini University', '{}'::text[], 'private_university', 'Solan', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chitkara University Himachal Pradesh', '{}'::text[], 'private_university', 'Baddi', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Eternal University', '{}'::text[], 'private_university', 'Baru Sahib', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharaja Agrasen University', '{}'::text[], 'private_university', 'Baddi', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Jammu', '{}'::text[], 'central_university', 'Jammu', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Jammu', '{}'::text[], 'state_university', 'Jammu', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Islamic University of Science and Technology', '{}'::text[], 'state_university', 'Awantipora', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Srinagar', '{}'::text[], 'nit', 'Srinagar', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Baba Ghulam Shah Badshah University', '{}'::text[], 'state_university', 'Rajouri', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cluster University of Srinagar', '{}'::text[], 'state_university', 'Srinagar', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sher-e-Kashmir University of Agricultural Sciences and Technology of Jammu', '{}'::text[], 'state_university', 'Jammu', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sher-e-Kashmir University of Agricultural Sciences and Technology of Kashmir', '{}'::text[], 'state_university', 'Srinagar', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. A.P.J. Abdul Kalam Technical University', '{}'::text[], 'state_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Ram Manohar Lohia Avadh University', '{}'::text[], 'state_university', 'Ayodhya', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bundelkhand University', '{}'::text[], 'state_university', 'Jhansi', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chaudhary Charan Singh University', '{}'::text[], 'state_university', 'Meerut', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Deen Dayal Upadhyaya Gorakhpur University', '{}'::text[], 'state_university', 'Gorakhpur', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gautam Buddha University', '{}'::text[], 'state_university', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('IIMT University', '{}'::text[], 'private_university', 'Meerut', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Teerthanker Mahaveer University', '{}'::text[], 'private_university', 'Moradabad', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KIET Group of Institutions', '{}'::text[], 'other', 'Ghaziabad', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Noida Institute of Engineering and Technology', '{}'::text[], 'other', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ajay Kumar Garg Engineering College', '{}'::text[], 'other', 'Ghaziabad', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Institute of Technology and Management Gorakhpur', '{}'::text[], 'other', 'Gorakhpur', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sanskriti University', '{}'::text[], 'private_university', 'Mathura', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Allahabad', '{}'::text[], 'central_university', 'Prayagraj', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Lucknow', '{}'::text[], 'other', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharshi Dayanand University', '{}'::text[], 'state_university', 'Rohtak', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Deenbandhu Chhotu Ram University of Science and Technology', '{}'::text[], 'state_university', 'Murthal', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Kurukshetra', '{}'::text[], 'nit', 'Kurukshetra', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Manav Rachna International Institute of Research and Studies', '{}'::text[], 'deemed_university', 'Faridabad', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('World University of Design', '{}'::text[], 'private_university', 'Sonipat', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Haryana', '{}'::text[], 'central_university', 'Mahendragarh', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Rohtak', '{}'::text[], 'other', 'Rohtak', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('North Maharashtra University', '{}'::text[], 'state_university', 'Jalgaon', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Babasaheb Ambedkar Marathwada University', '{}'::text[], 'state_university', 'Chhatrapati Sambhajinagar', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shivaji University', '{}'::text[], 'state_university', 'Kolhapur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sant Gadge Baba Amravati University', '{}'::text[], 'state_university', 'Amravati', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rashtrasant Tukadoji Maharaj Nagpur University', '{}'::text[], 'state_university', 'Nagpur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Yashwantrao Chavan Maharashtra Open University', '{}'::text[], 'state_university', 'Nashik', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharashtra Institute of Technology Aurangabad', '{}'::text[], 'other', 'Chhatrapati Sambhajinagar', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Walchand Institute of Technology', '{}'::text[], 'other', 'Solapur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government College of Engineering, Aurangabad', '{}'::text[], 'other', 'Chhatrapati Sambhajinagar', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vishwakarma Institute of Technology', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. D. Y. Patil Institute of Technology', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Pune Institute of Computer Technology', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sardar Patel Institute of Technology', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Veermata Jijabai Technological Institute', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KLE Technological University', '{}'::text[], 'private_university', 'Hubballi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Mysore', '{}'::text[], 'state_university', 'Mysuru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mangalore University', '{}'::text[], 'state_university', 'Mangaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gulbarga University', '{}'::text[], 'state_university', 'Kalaburagi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tumkur University', '{}'::text[], 'state_university', 'Tumakuru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Karnataka State Law University', '{}'::text[], 'state_university', 'Hubballi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law School of India University', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Bangalore', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Kozhikode', '{}'::text[], 'other', 'Kozhikode', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Kerala', '{}'::text[], 'state_university', 'Thiruvananthapuram', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cochin University of Science and Technology', '{}'::text[], 'state_university', 'Kochi', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Calicut', '{}'::text[], 'state_university', 'Malappuram', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mahatma Gandhi University, Kottayam', '{}'::text[], 'state_university', 'Kottayam', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kerala University of Health Sciences', '{}'::text[], 'state_university', 'Thrissur', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tamil Nadu Agricultural University', '{}'::text[], 'state_university', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bharathiar University', '{}'::text[], 'state_university', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bharathidasan University', '{}'::text[], 'state_university', 'Tiruchirappalli', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Madurai Kamaraj University', '{}'::text[], 'state_university', 'Madurai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Periyar University', '{}'::text[], 'state_university', 'Salem', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Annamalai University', '{}'::text[], 'state_university', 'Chidambaram', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tamil Nadu Dr. M.G.R. Medical University', '{}'::text[], 'state_university', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Tiruchirappalli', '{}'::text[], 'other', 'Tiruchirappalli', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Pondicherry University', '{}'::text[], 'central_university', 'Puducherry', 'Puducherry', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Tamil Nadu', '{}'::text[], 'central_university', 'Thiruvarur', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Puducherry', '{}'::text[], 'nit', 'Karaikal', 'Puducherry', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Patna University', '{}'::text[], 'state_university', 'Patna', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Patna', '{}'::text[], 'nit', 'Patna', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of South Bihar', '{}'::text[], 'central_university', 'Gaya', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Babasaheb Bhimrao Ambedkar Bihar University', '{}'::text[], 'state_university', 'Muzaffarpur', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ranchi University', '{}'::text[], 'state_university', 'Ranchi', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Birla Institute of Technology Mesra', '{}'::text[], 'deemed_university', 'Ranchi', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Jamshedpur', '{}'::text[], 'nit', 'Jamshedpur', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Ranchi', '{}'::text[], 'other', 'Ranchi', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Aryabhatta Knowledge University', '{}'::text[], 'state_university', 'Patna', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Nalanda University', '{}'::text[], 'central_university', 'Rajgir', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chanakya National Law University', '{}'::text[], 'other', 'Patna', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bihar Agricultural University', '{}'::text[], 'state_university', 'Sabour', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Magadh University', '{}'::text[], 'state_university', 'Bodh Gaya', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Veer Kunwar Singh University', '{}'::text[], 'state_university', 'Ara', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Purnea University', '{}'::text[], 'state_university', 'Purnia', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Lalit Narayan Mithila University', '{}'::text[], 'state_university', 'Darbhanga', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Jharkhand', '{}'::text[], 'private_university', 'Ranchi', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Jharkhand', '{}'::text[], 'central_university', 'Ranchi', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kolhan University', '{}'::text[], 'state_university', 'Chaibasa', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sido Kanhu Murmu University', '{}'::text[], 'state_university', 'Dumka', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vinoba Bhave University', '{}'::text[], 'state_university', 'Hazaribagh', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('XIM University', '{}'::text[], 'private_university', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Odisha University of Technology and Research', '{}'::text[], 'state_university', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Fakir Mohan University', '{}'::text[], 'state_university', 'Balasore', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Berhampur University', '{}'::text[], 'state_university', 'Berhampur', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ravenshaw University', '{}'::text[], 'state_university', 'Cuttack', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Odisha University of Agriculture and Technology', '{}'::text[], 'state_university', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Veer Surendra Sai University of Technology', '{}'::text[], 'state_university', 'Burla', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sambalpur University', '{}'::text[], 'state_university', 'Sambalpur', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kalinga Institute of Social Sciences', '{}'::text[], 'deemed_university', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maulana Abul Kalam Azad University of Technology', '{}'::text[], 'state_university', 'Haringhata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Kalyani', '{}'::text[], 'state_university', 'Kalyani', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of North Bengal', '{}'::text[], 'state_university', 'Siliguri', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Presidency University, Kolkata', '{}'::text[], 'state_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rabindra Bharati University', '{}'::text[], 'state_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Calcutta', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Engineering Science and Technology Shibpur', '{}'::text[], 'research_institute', 'Howrah', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Adamas University', '{}'::text[], 'private_university', 'Barasat', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sister Nivedita University', '{}'::text[], 'private_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Brainware University', '{}'::text[], 'private_university', 'Barasat', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Kolkata', '{}'::text[], 'private_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Engineering and Management Kolkata', '{}'::text[], 'private_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Assam University', '{}'::text[], 'central_university', 'Silchar', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Silchar', '{}'::text[], 'nit', 'Silchar', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dibrugarh University', '{}'::text[], 'state_university', 'Dibrugarh', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Assam Don Bosco University', '{}'::text[], 'private_university', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Assam down town University', '{}'::text[], 'private_university', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cotton University', '{}'::text[], 'state_university', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Royal Global University', '{}'::text[], 'private_university', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('North-Eastern Hill University', '{}'::text[], 'central_university', 'Shillong', 'Meghalaya', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Science and Technology Meghalaya', '{}'::text[], 'private_university', 'Ri-Bhoi', 'Meghalaya', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Martin Luther Christian University', '{}'::text[], 'private_university', 'Shillong', 'Meghalaya', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mizoram University', '{}'::text[], 'central_university', 'Aizawl', 'Mizoram', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tripura University', '{}'::text[], 'central_university', 'Agartala', 'Tripura', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Agartala', '{}'::text[], 'nit', 'Agartala', 'Tripura', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sikkim University', '{}'::text[], 'central_university', 'Gangtok', 'Sikkim', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Banasthali Vidyapith', '{}'::text[], 'deemed_university', 'Banasthali', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Rajasthan', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jagannath University', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JECRC University', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Poornima University', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vivekananda Global University', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Suresh Gyan Vihar University', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajasthan Technical University', '{}'::text[], 'state_university', 'Kota', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Rajasthan', '{}'::text[], 'central_university', 'Ajmer', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jodhpur National University', '{}'::text[], 'private_university', 'Jodhpur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Gujarat', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Charotar University of Science and Technology', '{}'::text[], 'private_university', 'Anand', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ganpat University', '{}'::text[], 'private_university', 'Mehsana', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gujarat Technological University', '{}'::text[], 'state_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dhirubhai Ambani Institute of Information and Communication Technology', '{}'::text[], 'deemed_university', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Anand Agricultural University', '{}'::text[], 'state_university', 'Anand', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Junagadh Agricultural University', '{}'::text[], 'state_university', 'Junagadh', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Navsari Agricultural University', '{}'::text[], 'state_university', 'Navsari', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sardarkrushinagar Dantiwada Agricultural University', '{}'::text[], 'state_university', 'Banaskantha', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hemchandracharya North Gujarat University', '{}'::text[], 'state_university', 'Patan', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Veer Narmad South Gujarat University', '{}'::text[], 'state_university', 'Surat', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kadi Sarva Vishwavidyalaya', '{}'::text[], 'private_university', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rai University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Silver Oak University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ajeenkya D.Y. Patil University', '{}'::text[], 'private_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('D.Y. Patil International University', '{}'::text[], 'private_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('FLAME University', '{}'::text[], 'private_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gokhale Institute of Politics and Economics', '{}'::text[], 'deemed_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Homi Bhabha National Institute', '{}'::text[], 'deemed_university', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SNDT Women''s University', '{}'::text[], 'state_university', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharashtra National Law University Mumbai', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharashtra National Law University Nagpur', '{}'::text[], 'other', 'Nagpur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharashtra National Law University Aurangabad', '{}'::text[], 'other', 'Chhatrapati Sambhajinagar', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('MGM Institute of Health Sciences', '{}'::text[], 'deemed_university', 'Navi Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Datta Meghe Institute of Higher Education and Research', '{}'::text[], 'deemed_university', 'Wardha', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Mumbai', '{}'::text[], 'private_university', 'Panvel', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Somaiya Vidyavihar University', '{}'::text[], 'private_university', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Atal Bihari Vajpayee Indian Institute of Information Technology and Management', '{}'::text[], 'iiit', 'Gwalior', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jiwaji University', '{}'::text[], 'state_university', 'Gwalior', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rani Durgavati Vishwavidyalaya', '{}'::text[], 'state_university', 'Jabalpur', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Awadhesh Pratap Singh University', '{}'::text[], 'state_university', 'Rewa', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vikram University', '{}'::text[], 'state_university', 'Ujjain', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Madhya Pradesh', '{}'::text[], 'private_university', 'Gwalior', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jagran Lakecity University', '{}'::text[], 'private_university', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Medi-Caps University', '{}'::text[], 'private_university', 'Indore', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Prestige Institute of Management and Research', '{}'::text[], 'other', 'Indore', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Indore', '{}'::text[], 'other', 'Indore', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Punjabi University', '{}'::text[], 'state_university', 'Patiala', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharaja Ranjit Singh Punjab Technical University', '{}'::text[], 'state_university', 'Bathinda', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Guru Angad Dev Veterinary and Animal Sciences University', '{}'::text[], 'state_university', 'Ludhiana', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. B.R. Ambedkar National Institute of Technology', '{}'::text[], 'nit', 'Jalandhar', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Amritsar', '{}'::text[], 'other', 'Amritsar', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rayat Bahra University', '{}'::text[], 'private_university', 'Mohali', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Guru Kashi University', '{}'::text[], 'private_university', 'Talwandi Sabo', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Akal University', '{}'::text[], 'private_university', 'Talwandi Sabo', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Desh Bhagat University', '{}'::text[], 'private_university', 'Mandi Gobindgarh', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('CT University', '{}'::text[], 'private_university', 'Ludhiana', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('GNA University', '{}'::text[], 'private_university', 'Phagwara', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharishi Markandeshwar University', '{}'::text[], 'deemed_university', 'Mullana', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Haryana', '{}'::text[], 'private_university', 'Gurugram', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sushant University', '{}'::text[], 'private_university', 'Gurugram', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('GD Goenka University', '{}'::text[], 'private_university', 'Gurugram', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('The NorthCap University', '{}'::text[], 'private_university', 'Gurugram', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SRM University Delhi-NCR', '{}'::text[], 'private_university', 'Sonipat', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ch. Devi Lal University', '{}'::text[], 'state_university', 'Sirsa', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shree Guru Gobind Singh Tricentenary University', '{}'::text[], 'private_university', 'Gurugram', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Swami Vivekanand Subharti University', '{}'::text[], 'private_university', 'Meerut', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shobhit University', '{}'::text[], 'deemed_university', 'Meerut', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Noida International University', '{}'::text[], 'private_university', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Galgotias College of Engineering and Technology', '{}'::text[], 'other', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Greater Noida Institute of Technology', '{}'::text[], 'other', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Accurate Institute of Management and Technology', '{}'::text[], 'other', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('IIMT College of Engineering', '{}'::text[], 'other', 'Greater Noida', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('R.D. Engineering College', '{}'::text[], 'other', 'Ghaziabad', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('ABES Engineering College', '{}'::text[], 'other', 'Ghaziabad', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Raj Kumar Goel Institute of Technology', '{}'::text[], 'other', 'Ghaziabad', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('United Institute of Technology', '{}'::text[], 'other', 'Prayagraj', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Institute of Engineering and Technology Lucknow', '{}'::text[], 'other', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Babu Banarasi Das University', '{}'::text[], 'private_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Integral University', '{}'::text[], 'private_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Shakuntala Misra National Rehabilitation University', '{}'::text[], 'state_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Lucknow Campus', '{}'::text[], 'private_university', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dayalbagh Educational Institute', '{}'::text[], 'deemed_university', 'Agra', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Bhimrao Ambedkar University', '{}'::text[], 'state_university', 'Agra', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chhatrapati Shahu Ji Maharaj University', '{}'::text[], 'state_university', 'Kanpur', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Graphic Era Hill University', '{}'::text[], 'private_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dev Bhoomi Uttarakhand University', '{}'::text[], 'private_university', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Himalayan Institute of Technology', '{}'::text[], 'other', 'Dehradun', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Motherhood University', '{}'::text[], 'private_university', 'Roorkee', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Engineering and Management Jaipur', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Arya College of Engineering and IT', '{}'::text[], 'other', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajasthan College of Engineering for Women', '{}'::text[], 'other', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Swami Keshvanand Institute of Technology', '{}'::text[], 'other', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('MBM University', '{}'::text[], 'state_university', 'Jodhpur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('J.K. Lakshmipat University', '{}'::text[], 'private_university', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sir Padampat Singhania University', '{}'::text[], 'private_university', 'Udaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Pacific University', '{}'::text[], 'private_university', 'Udaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Rajasthan, College of Engineering and Technology', '{}'::text[], 'other', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajasthan University of Veterinary and Animal Sciences', '{}'::text[], 'state_university', 'Bikaner', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('GLS University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Parul University', '{}'::text[], 'private_university', 'Vadodara', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('ITM Vocational University', '{}'::text[], 'private_university', 'Vadodara', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Uka Tarsadia University', '{}'::text[], 'private_university', 'Bardoli', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indus University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ahmedabad Institute of Technology', '{}'::text[], 'other', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('L.J. Institute of Engineering and Technology', '{}'::text[], 'other', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SAL Institute of Technology and Engineering Research', '{}'::text[], 'other', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Darshan University', '{}'::text[], 'private_university', 'Rajkot', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('D.Y. Patil University', '{}'::text[], 'deemed_university', 'Navi Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. D.Y. Patil Vidyapeeth', '{}'::text[], 'deemed_university', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('A.P. Shah Institute of Technology', '{}'::text[], 'other', 'Thane', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Thakur College of Engineering and Technology', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Fr. Conceicao Rodrigues College of Engineering', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('CMR University', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Presidency University, Bengaluru', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Alliance University', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Acharya Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Reva University', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dayananda Sagar University', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bengaluru North University', '{}'::text[], 'state_university', 'Kolar', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Karnataka University', '{}'::text[], 'state_university', 'Dharwad', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajiv Gandhi University of Health Sciences', '{}'::text[], 'state_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Karnataka State Open University', '{}'::text[], 'state_university', 'Mysuru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Telangana University', '{}'::text[], 'state_university', 'Nizamabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mahatma Gandhi University, Nalgonda', '{}'::text[], 'state_university', 'Nalgonda', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Anurag University', '{}'::text[], 'private_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Malla Reddy University', '{}'::text[], 'private_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Woxsen University', '{}'::text[], 'private_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('ICFAI Foundation for Higher Education', '{}'::text[], 'deemed_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chaitanya Bharathi Institute of Technology', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vasavi College of Engineering', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gokaraju Rangaraju Institute of Engineering and Technology', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sreenidhi Institute of Science and Technology', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vardhaman College of Engineering', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('CVR College of Engineering', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('BVRIT Hyderabad College of Engineering for Women', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mahatma Gandhi Institute of Technology', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JNTU University College of Engineering Hyderabad', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('PSG College of Technology', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Thiagarajar College of Engineering', '{}'::text[], 'other', 'Madurai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government College of Technology, Coimbatore', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Erode Sengunthar Engineering College', '{}'::text[], 'other', 'Erode', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Mahalingam College of Engineering and Technology', '{}'::text[], 'other', 'Pollachi', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mepco Schlenk Engineering College', '{}'::text[], 'other', 'Sivakasi', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Engineering College', '{}'::text[], 'other', 'Kovilpatti', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Velammal Engineering College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Easwari Engineering College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sri Sairam Engineering College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Panimalar Engineering College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('St. Joseph''s College of Engineering', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chennai Institute of Technology', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajalakshmi Engineering College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Saveetha Engineering College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KCG College of Technology', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sri Krishna College of Engineering and Technology', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kumaraguru College of Technology', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bannari Amman Institute of Technology', '{}'::text[], 'other', 'Sathyamangalam', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kongu Engineering College', '{}'::text[], 'other', 'Perundurai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sri Ramakrishna Engineering College', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Karpagam College of Engineering', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Adhiyamaan College of Engineering', '{}'::text[], 'other', 'Hosur', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government College of Engineering, Salem', '{}'::text[], 'other', 'Salem', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government College of Engineering, Tirunelveli', '{}'::text[], 'other', 'Tirunelveli', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government Engineering College, Thrissur', '{}'::text[], 'other', 'Thrissur', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('TKM College of Engineering', '{}'::text[], 'other', 'Kollam', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajagiri School of Engineering and Technology', '{}'::text[], 'other', 'Kochi', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Model Engineering College', '{}'::text[], 'other', 'Kochi', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('College of Engineering Trivandrum', '{}'::text[], 'other', 'Thiruvananthapuram', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mar Athanasius College of Engineering', '{}'::text[], 'other', 'Kothamangalam', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Federal Institute of Science and Technology', '{}'::text[], 'other', 'Angamaly', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amal Jyothi College of Engineering', '{}'::text[], 'other', 'Kanjirappally', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Saintgits College of Engineering', '{}'::text[], 'other', 'Kottayam', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('College of Engineering Chengannur', '{}'::text[], 'other', 'Chengannur', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government Engineering College, Barton Hill', '{}'::text[], 'other', 'Thiruvananthapuram', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NSS College of Engineering', '{}'::text[], 'other', 'Palakkad', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('A.P. Engineering College', '{}'::text[], 'other', 'Vijayawada', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('RVR & JC College of Engineering', '{}'::text[], 'other', 'Guntur', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Prasad V. Potluri Siddhartha Institute of Technology', '{}'::text[], 'other', 'Vijayawada', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Andhra Loyola Institute of Engineering and Technology', '{}'::text[], 'other', 'Vijayawada', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sagi Ramakrishnam Raju Engineering College', '{}'::text[], 'other', 'Bhimavaram', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gayatri Vidya Parishad College of Engineering', '{}'::text[], 'other', 'Visakhapatnam', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Anil Neerukonda Institute of Technology and Sciences', '{}'::text[], 'other', 'Visakhapatnam', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Aditya Engineering College', '{}'::text[], 'other', 'Surampalem', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JNTU College of Engineering Anantapur', '{}'::text[], 'other', 'Anantapur', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JNTU College of Engineering Kakinada', '{}'::text[], 'other', 'Kakinada', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('G. Pulla Reddy Engineering College', '{}'::text[], 'other', 'Kurnool', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sri Venkateswara College of Engineering', '{}'::text[], 'other', 'Tirupati', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajeev Gandhi Memorial College of Engineering and Technology', '{}'::text[], 'other', 'Nandyal', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('B.V. Bhoomaraddi College of Engineering and Technology', '{}'::text[], 'other', 'Hubballi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KLE Society''s S. Nijalingappa College', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sir M. Visvesvaraya Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University Visvesvaraya College of Engineering', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('B.N.M. Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('RNS Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sambhram Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Atria Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('East West Institute of Technology', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('N.M.A.M. Institute of Technology', '{}'::text[], 'other', 'Nitte', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Canara Engineering College', '{}'::text[], 'other', 'Mangaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sahyadri College of Engineering and Management', '{}'::text[], 'other', 'Mangaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('St. Joseph Engineering College', '{}'::text[], 'other', 'Mangaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jain College of Engineering', '{}'::text[], 'other', 'Belagavi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KLS Gogte Institute of Technology', '{}'::text[], 'other', 'Belagavi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Basaveshwar Engineering College', '{}'::text[], 'other', 'Bagalkot', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SDM College of Engineering and Technology', '{}'::text[], 'other', 'Dharwad', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hirasugar Institute of Technology', '{}'::text[], 'other', 'Nidasoshi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bapuji Institute of Engineering and Technology', '{}'::text[], 'other', 'Davangere', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JSS Science and Technology University', '{}'::text[], 'private_university', 'Mysuru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vidyavardhaka College of Engineering', '{}'::text[], 'other', 'Mysuru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('The National Institute of Engineering', '{}'::text[], 'other', 'Mysuru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Malnad College of Engineering', '{}'::text[], 'other', 'Hassan', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('PES College of Engineering', '{}'::text[], 'other', 'Mandya', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('A.M.C. Engineering College', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Heritage Institute of Technology', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Institute of Engineering and Management', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JIS College of Engineering', '{}'::text[], 'other', 'Kalyani', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Haldia Institute of Technology', '{}'::text[], 'other', 'Haldia', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Narula Institute of Technology', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kalyani Government Engineering College', '{}'::text[], 'other', 'Kalyani', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cooch Behar Government Engineering College', '{}'::text[], 'other', 'Cooch Behar', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jalpaiguri Government Engineering College', '{}'::text[], 'other', 'Jalpaiguri', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Assam Engineering College', '{}'::text[], 'other', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jorhat Engineering College', '{}'::text[], 'other', 'Jorhat', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tezpur Medical College and Hospital', '{}'::text[], 'other', 'Tezpur', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Assam Medical College', '{}'::text[], 'other', 'Dibrugarh', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gauhati Medical College', '{}'::text[], 'other', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('North Eastern Regional Institute of Science and Technology', '{}'::text[], 'deemed_university', 'Nirjuli', 'Arunachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajiv Gandhi University', '{}'::text[], 'central_university', 'Itanagar', 'Arunachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Meghalaya', '{}'::text[], 'nit', 'Shillong', 'Meghalaya', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Manipur', '{}'::text[], 'nit', 'Imphal', 'Manipur', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Manipur University', '{}'::text[], 'central_university', 'Imphal', 'Manipur', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Mizoram', '{}'::text[], 'nit', 'Aizawl', 'Mizoram', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Nagaland', '{}'::text[], 'nit', 'Dimapur', 'Nagaland', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Nagaland University', '{}'::text[], 'central_university', 'Lumami', 'Nagaland', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Sikkim', '{}'::text[], 'nit', 'Ravangla', 'Sikkim', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Arunachal Pradesh', '{}'::text[], 'nit', 'Yupia', 'Arunachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('All India Institute of Medical Sciences New Delhi', '{}'::text[], 'research_institute', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('AIIMS Jodhpur', '{}'::text[], 'research_institute', 'Jodhpur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('AIIMS Bhopal', '{}'::text[], 'research_institute', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('AIIMS Bhubaneswar', '{}'::text[], 'research_institute', 'Bhubaneswar', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('AIIMS Patna', '{}'::text[], 'research_institute', 'Patna', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('AIIMS Rishikesh', '{}'::text[], 'research_institute', 'Rishikesh', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('AIIMS Raipur', '{}'::text[], 'research_institute', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Christian Medical College', '{}'::text[], 'other', 'Vellore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kasturba Medical College, Manipal', '{}'::text[], 'other', 'Manipal', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kasturba Medical College, Mangaluru', '{}'::text[], 'other', 'Mangaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('St. John''s Medical College', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maulana Azad Medical College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Lady Hardinge Medical College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Armed Forces Medical College', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Seth GS Medical College', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Institute of Medical Sciences, BHU', '{}'::text[], 'other', 'Varanasi', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Madras Medical College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government Medical College and Hospital, Chandigarh', '{}'::text[], 'other', 'Chandigarh', 'Chandigarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('JIPMER', '{}'::text[], 'research_institute', 'Puducherry', 'Puducherry', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Ahmedabad', '{}'::text[], 'other', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Mumbai', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Shillong', '{}'::text[], 'other', 'Shillong', 'Meghalaya', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Udaipur', '{}'::text[], 'other', 'Udaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Kashipur', '{}'::text[], 'other', 'Kashipur', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Raipur', '{}'::text[], 'other', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Nagpur', '{}'::text[], 'other', 'Nagpur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Visakhapatnam', '{}'::text[], 'other', 'Visakhapatnam', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Bodh Gaya', '{}'::text[], 'other', 'Bodh Gaya', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Jammu', '{}'::text[], 'other', 'Jammu', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Management Sambalpur', '{}'::text[], 'other', 'Sambalpur', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('XLRI - Xavier School of Management', '{}'::text[], 'other', 'Jamshedpur', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('SP Jain Institute of Management and Research', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Management Development Institute', '{}'::text[], 'other', 'Gurugram', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Narsee Monjee Institute of Management Studies', '{}'::text[], 'deemed_university', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Foreign Trade', '{}'::text[], 'deemed_university', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law University Delhi', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law University Jodhpur', '{}'::text[], 'other', 'Jodhpur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NALSAR University of Law', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Gujarat National Law University', '{}'::text[], 'other', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law Institute University', '{}'::text[], 'other', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('West Bengal National University of Juridical Sciences', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hidayatullah National Law University', '{}'::text[], 'other', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National University of Advanced Legal Studies', '{}'::text[], 'other', 'Kochi', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajiv Gandhi National University of Law', '{}'::text[], 'other', 'Patiala', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law University Odisha', '{}'::text[], 'other', 'Cuttack', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law University and Judicial Academy Assam', '{}'::text[], 'other', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tamil Nadu National Law University', '{}'::text[], 'other', 'Tiruchirappalli', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Himachal Pradesh National Law University', '{}'::text[], 'other', 'Shimla', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Ram Manohar Lohiya National Law University', '{}'::text[], 'other', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Law University Tripura', '{}'::text[], 'other', 'Agartala', 'Tripura', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ambedkar University Delhi', '{}'::text[], 'state_university', 'Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Agricultural Research Institute', '{}'::text[], 'deemed_university', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Veterinary Research Institute', '{}'::text[], 'deemed_university', 'Izatnagar', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Govind Ballabh Pant University of Agriculture and Technology', '{}'::text[], 'state_university', 'Pantnagar', 'Uttarakhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chaudhary Charan Singh Haryana Agricultural University', '{}'::text[], 'state_university', 'Hisar', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. Y.S. Parmar University of Horticulture and Forestry', '{}'::text[], 'state_university', 'Nauni', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jawaharlal Nehru Krishi Vishwa Vidyalaya', '{}'::text[], 'state_university', 'Jabalpur', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indira Gandhi Krishi Vishwavidyalaya', '{}'::text[], 'state_university', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rajendra Prasad Central Agricultural University', '{}'::text[], 'central_university', 'Pusa', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Assam Agricultural University', '{}'::text[], 'state_university', 'Jorhat', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Acharya N.G. Ranga Agricultural University', '{}'::text[], 'state_university', 'Guntur', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Professor Jayashankar Telangana State Agricultural University', '{}'::text[], 'state_university', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kerala Agricultural University', '{}'::text[], 'state_university', 'Thrissur', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Agricultural Sciences, Bengaluru', '{}'::text[], 'state_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Agricultural Sciences, Dharwad', '{}'::text[], 'state_university', 'Dharwad', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maharashtra Animal and Fishery Sciences University', '{}'::text[], 'state_university', 'Nagpur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('West Bengal University of Animal and Fishery Sciences', '{}'::text[], 'state_university', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Pharmaceutical Education and Research Mohali', '{}'::text[], 'research_institute', 'Mohali', 'Punjab', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIPER Hyderabad', '{}'::text[], 'research_institute', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIPER Ahmedabad', '{}'::text[], 'research_institute', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIPER Kolkata', '{}'::text[], 'research_institute', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIPER Guwahati', '{}'::text[], 'research_institute', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIPER Raebareli', '{}'::text[], 'research_institute', 'Raebareli', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Design Ahmedabad', '{}'::text[], 'research_institute', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Design Bengaluru', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Design Gandhinagar', '{}'::text[], 'other', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Fashion Technology New Delhi', '{}'::text[], 'research_institute', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIFT Mumbai', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIFT Bengaluru', '{}'::text[], 'other', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIFT Chennai', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIFT Hyderabad', '{}'::text[], 'other', 'Hyderabad', 'Telangana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIFT Kolkata', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NIFT Gandhinagar', '{}'::text[], 'other', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NITTTR Chandigarh', '{}'::text[], 'other', 'Chandigarh', 'Chandigarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NITTTR Bhopal', '{}'::text[], 'other', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NITTTR Chennai', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('NITTTR Kolkata', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Gwalior', '{}'::text[], 'iiit', 'Gwalior', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Jabalpur', '{}'::text[], 'iiit', 'Jabalpur', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Kancheepuram', '{}'::text[], 'iiit', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Kota', '{}'::text[], 'iiit', 'Kota', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Sri City', '{}'::text[], 'iiit', 'Chittoor', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Vadodara', '{}'::text[], 'iiit', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Pune', '{}'::text[], 'iiit', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Nagpur', '{}'::text[], 'iiit', 'Nagpur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Kalyani', '{}'::text[], 'iiit', 'Kalyani', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Una', '{}'::text[], 'iiit', 'Una', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Dharwad', '{}'::text[], 'iiit', 'Dharwad', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Tiruchirappalli', '{}'::text[], 'iiit', 'Tiruchirappalli', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Lucknow', '{}'::text[], 'iiit', 'Lucknow', 'Uttar Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Ranchi', '{}'::text[], 'iiit', 'Ranchi', 'Jharkhand', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Bhagalpur', '{}'::text[], 'iiit', 'Bhagalpur', 'Bihar', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Bhopal', '{}'::text[], 'iiit', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Surat', '{}'::text[], 'iiit', 'Surat', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Manipur', '{}'::text[], 'iiit', 'Imphal', 'Manipur', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Sonepat', '{}'::text[], 'iiit', 'Sonipat', 'Haryana', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Agartala', '{}'::text[], 'iiit', 'Agartala', 'Tripura', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Raichur', '{}'::text[], 'iiit', 'Raichur', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Kottayam', '{}'::text[], 'iiit', 'Kottayam', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Guwahati', '{}'::text[], 'iiit', 'Guwahati', 'Assam', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Information Technology Design and Manufacturing Kurnool', '{}'::text[], 'iiit', 'Kurnool', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shri Ram College of Commerce', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hindu College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('St. Stephen''s College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Lady Shri Ram College for Women', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hansraj College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kirori Mal College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Miranda House', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ramjas College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sri Venkateswara College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jesus and Mary College', '{}'::text[], 'other', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Christ College, Irinjalakuda', '{}'::text[], 'other', 'Irinjalakuda', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Loyola College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Presidency College, Chennai', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Madras Christian College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Stella Maris College', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ethiraj College for Women', '{}'::text[], 'other', 'Chennai', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('PSG College of Arts and Science', '{}'::text[], 'other', 'Coimbatore', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('St. Xavier''s College, Mumbai', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hinduja College of Commerce', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mithibai College', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jai Hind College', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Fergusson College', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Symbiosis College of Arts and Commerce', '{}'::text[], 'other', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('St. Xavier''s College, Kolkata', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Scottish Church College', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('School of Planning and Architecture Delhi', '{}'::text[], 'research_institute', 'New Delhi', 'Delhi', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('School of Planning and Architecture Bhopal', '{}'::text[], 'research_institute', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('School of Planning and Architecture Vijayawada', '{}'::text[], 'research_institute', 'Vijayawada', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sir J.J. College of Architecture', '{}'::text[], 'other', 'Mumbai', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('CEPT University', '{}'::text[], 'private_university', 'Ahmedabad', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chandigarh College of Architecture', '{}'::text[], 'other', 'Chandigarh', 'Chandigarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bengal Institute of Technology', '{}'::text[], 'other', 'Kolkata', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Science Education and Research Pune', '{}'::text[], 'research_institute', 'Pune', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Science Education and Research Kolkata', '{}'::text[], 'research_institute', 'Nadia', 'West Bengal', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Science Education and Research Bhopal', '{}'::text[], 'research_institute', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Science Education and Research Thiruvananthapuram', '{}'::text[], 'research_institute', 'Thiruvananthapuram', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Science Education and Research Tirupati', '{}'::text[], 'research_institute', 'Tirupati', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Science Education and Research Berhampur', '{}'::text[], 'research_institute', 'Berhampur', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Goa', '{}'::text[], 'nit', 'Ponda', 'Goa', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Goa University', '{}'::text[], 'state_university', 'Taleigao', 'Goa', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Don Bosco College of Engineering', '{}'::text[], 'other', 'Fatorda', 'Goa', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Goa College of Engineering', '{}'::text[], 'other', 'Farmagudi', 'Goa', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dhempe College of Arts and Science', '{}'::text[], 'other', 'Panaji', 'Goa', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Raipur', '{}'::text[], 'nit', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Technology Bhilai', '{}'::text[], 'iit', 'Bhilai', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chhattisgarh Swami Vivekanand Technical University', '{}'::text[], 'state_university', 'Bhilai', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Guru Ghasidas Vishwavidyalaya', '{}'::text[], 'central_university', 'Bilaspur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Amity University Chhattisgarh', '{}'::text[], 'private_university', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Atal Bihari Vajpayee University', '{}'::text[], 'state_university', 'Bilaspur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kalinga University', '{}'::text[], 'private_university', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('MATS University', '{}'::text[], 'private_university', 'Raipur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('ISBM University', '{}'::text[], 'private_university', 'Gariyaband', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dr. C.V. Raman University', '{}'::text[], 'private_university', 'Bilaspur', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indira Kala Sangeet Vishwavidyalaya', '{}'::text[], 'state_university', 'Khairagarh', 'Chhattisgarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Karnataka', '{}'::text[], 'nit', 'Surathkal', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Institute of Technology Andhra Pradesh', '{}'::text[], 'nit', 'Tadepalligudem', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Andhra Pradesh', '{}'::text[], 'central_university', 'Anantapur', 'Andhra Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Kerala', '{}'::text[], 'central_university', 'Kasaragod', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Karnataka', '{}'::text[], 'central_university', 'Kalaburagi', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Gujarat', '{}'::text[], 'central_university', 'Gandhinagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Odisha', '{}'::text[], 'central_university', 'Koraput', 'Odisha', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Central University of Kashmir', '{}'::text[], 'central_university', 'Ganderbal', 'Jammu and Kashmir', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('DAV College, Chandigarh', '{}'::text[], 'other', 'Chandigarh', 'Chandigarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Government College for Girls, Chandigarh', '{}'::text[], 'other', 'Chandigarh', 'Chandigarh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Technology Mandi', '{}'::text[], 'iit', 'Mandi', 'Himachal Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jai Narain Vyas University', '{}'::text[], 'state_university', 'Jodhpur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Malaviya National Institute of Technology Jaipur', '{}'::text[], 'nit', 'Jaipur', 'Rajasthan', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sardar Patel University', '{}'::text[], 'state_university', 'Vallabh Vidyanagar', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Saurashtra University', '{}'::text[], 'state_university', 'Rajkot', 'Gujarat', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Maulana Azad National Institute of Technology', '{}'::text[], 'nit', 'Bhopal', 'Madhya Pradesh', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Visvesvaraya National Institute of Technology', '{}'::text[], 'nit', 'Nagpur', 'Maharashtra', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Goa Institute of Management', '{}'::text[], 'other', 'Sanquelim', 'Goa', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bengaluru City University', '{}'::text[], 'state_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Bangalore University', '{}'::text[], 'state_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ramaiah University of Applied Sciences', '{}'::text[], 'private_university', 'Bengaluru', 'Karnataka', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Alagappa University', '{}'::text[], 'state_university', 'Karaikudi', 'Tamil Nadu', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Indian Institute of Technology Palakkad', '{}'::text[], 'iit', 'Palakkad', 'Kerala', 'IN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Harvard University', '{}'::text[], 'foreign_university', 'Cambridge', 'Massachusetts', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('California Institute of Technology', '{}'::text[], 'foreign_university', 'Pasadena', 'California', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of California, Los Angeles', '{}'::text[], 'foreign_university', 'Los Angeles', 'California', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of California, San Diego', '{}'::text[], 'foreign_university', 'San Diego', 'California', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Southern California', '{}'::text[], 'foreign_university', 'Los Angeles', 'California', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Pennsylvania', '{}'::text[], 'foreign_university', 'Philadelphia', 'Pennsylvania', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Princeton University', '{}'::text[], 'foreign_university', 'Princeton', 'New Jersey', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Yale University', '{}'::text[], 'foreign_university', 'New Haven', 'Connecticut', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Columbia University', '{}'::text[], 'foreign_university', 'New York City', 'New York', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cornell University', '{}'::text[], 'foreign_university', 'Ithaca', 'New York', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('New York University', '{}'::text[], 'foreign_university', 'New York City', 'New York', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Chicago', '{}'::text[], 'foreign_university', 'Chicago', 'Illinois', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Northwestern University', '{}'::text[], 'foreign_university', 'Evanston', 'Illinois', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Illinois Urbana-Champaign', '{}'::text[], 'foreign_university', 'Urbana-Champaign', 'Illinois', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Michigan', '{}'::text[], 'foreign_university', 'Ann Arbor', 'Michigan', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Purdue University', '{}'::text[], 'foreign_university', 'West Lafayette', 'Indiana', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Georgia Institute of Technology', '{}'::text[], 'foreign_university', 'Atlanta', 'Georgia', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Texas at Austin', '{}'::text[], 'foreign_university', 'Austin', 'Texas', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Rice University', '{}'::text[], 'foreign_university', 'Houston', 'Texas', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Washington', '{}'::text[], 'foreign_university', 'Seattle', 'Washington', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Duke University', '{}'::text[], 'foreign_university', 'Durham', 'North Carolina', 'US', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University College London', '{}'::text[], 'foreign_university', 'London', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('King''s College London', '{}'::text[], 'foreign_university', 'London', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('London School of Economics and Political Science', '{}'::text[], 'foreign_university', 'London', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Edinburgh', '{}'::text[], 'foreign_university', 'Edinburgh', 'Scotland', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Glasgow', '{}'::text[], 'foreign_university', 'Glasgow', 'Scotland', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Warwick', '{}'::text[], 'foreign_university', 'Coventry', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Bristol', '{}'::text[], 'foreign_university', 'Bristol', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Birmingham', '{}'::text[], 'foreign_university', 'Birmingham', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Leeds', '{}'::text[], 'foreign_university', 'Leeds', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Sheffield', '{}'::text[], 'foreign_university', 'Sheffield', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Nottingham', '{}'::text[], 'foreign_university', 'Nottingham', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Southampton', '{}'::text[], 'foreign_university', 'Southampton', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Liverpool', '{}'::text[], 'foreign_university', 'Liverpool', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Durham University', '{}'::text[], 'foreign_university', 'Durham', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of York', '{}'::text[], 'foreign_university', 'York', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Queen Mary University of London', '{}'::text[], 'foreign_university', 'London', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Exeter', '{}'::text[], 'foreign_university', 'Exeter', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Bath', '{}'::text[], 'foreign_university', 'Bath', 'England', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cardiff University', '{}'::text[], 'foreign_university', 'Cardiff', 'Wales', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Queen''s University Belfast', '{}'::text[], 'foreign_university', 'Belfast', 'Northern Ireland', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of St Andrews', '{}'::text[], 'foreign_university', 'St Andrews', 'Scotland', 'GB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('McGill University', '{}'::text[], 'foreign_university', 'Montreal', 'Quebec', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Alberta', '{}'::text[], 'foreign_university', 'Edmonton', 'Alberta', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('McMaster University', '{}'::text[], 'foreign_university', 'Hamilton', 'Ontario', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Montreal', '{}'::text[], 'foreign_university', 'Montreal', 'Quebec', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Ottawa', '{}'::text[], 'foreign_university', 'Ottawa', 'Ontario', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Calgary', '{}'::text[], 'foreign_university', 'Calgary', 'Alberta', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Queen''s University', '{}'::text[], 'foreign_university', 'Kingston', 'Ontario', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Simon Fraser University', '{}'::text[], 'foreign_university', 'Burnaby', 'British Columbia', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Manitoba', '{}'::text[], 'foreign_university', 'Winnipeg', 'Manitoba', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Dalhousie University', '{}'::text[], 'foreign_university', 'Halifax', 'Nova Scotia', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Victoria', '{}'::text[], 'foreign_university', 'Victoria', 'British Columbia', 'CA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Sydney', '{}'::text[], 'foreign_university', 'Sydney', 'New South Wales', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Australian National University', '{}'::text[], 'foreign_university', 'Canberra', 'Australian Capital Territory', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Queensland', '{}'::text[], 'foreign_university', 'Brisbane', 'Queensland', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Western Australia', '{}'::text[], 'foreign_university', 'Perth', 'Western Australia', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Adelaide', '{}'::text[], 'foreign_university', 'Adelaide', 'South Australia', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Queensland University of Technology', '{}'::text[], 'foreign_university', 'Brisbane', 'Queensland', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('RMIT University', '{}'::text[], 'foreign_university', 'Melbourne', 'Victoria', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Tasmania', '{}'::text[], 'foreign_university', 'Hobart', 'Tasmania', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Curtin University', '{}'::text[], 'foreign_university', 'Perth', 'Western Australia', 'AU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Auckland', '{}'::text[], 'foreign_university', 'Auckland', NULL, 'NZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Otago', '{}'::text[], 'foreign_university', 'Dunedin', NULL, 'NZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Victoria University of Wellington', '{}'::text[], 'foreign_university', 'Wellington', NULL, 'NZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Canterbury', '{}'::text[], 'foreign_university', 'Christchurch', NULL, 'NZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Auckland University of Technology', '{}'::text[], 'foreign_university', 'Auckland', NULL, 'NZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Waikato', '{}'::text[], 'foreign_university', 'Hamilton', NULL, 'NZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('EPFL', '{}'::text[], 'foreign_university', 'Lausanne', NULL, 'CH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Zurich', '{}'::text[], 'foreign_university', 'Zurich', NULL, 'CH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Geneva', '{}'::text[], 'foreign_university', 'Geneva', NULL, 'CH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ludwig Maximilian University of Munich', '{}'::text[], 'foreign_university', 'Munich', NULL, 'DE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Heidelberg University', '{}'::text[], 'foreign_university', 'Heidelberg', NULL, 'DE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('RWTH Aachen University', '{}'::text[], 'foreign_university', 'Aachen', NULL, 'DE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Amsterdam', '{}'::text[], 'foreign_university', 'Amsterdam', NULL, 'NL', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Leiden University', '{}'::text[], 'foreign_university', 'Leiden', NULL, 'NL', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KU Leuven', '{}'::text[], 'foreign_university', 'Leuven', NULL, 'BE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sorbonne University', '{}'::text[], 'foreign_university', 'Paris', NULL, 'FR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('École Polytechnique', '{}'::text[], 'foreign_university', 'Palaiseau', NULL, 'FR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Copenhagen', '{}'::text[], 'foreign_university', 'Copenhagen', NULL, 'DK', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kyoto University', '{}'::text[], 'foreign_university', 'Kyoto', NULL, 'JP', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Osaka University', '{}'::text[], 'foreign_university', 'Osaka', NULL, 'JP', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tohoku University', '{}'::text[], 'foreign_university', 'Sendai', NULL, 'JP', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tokyo Institute of Technology', '{}'::text[], 'foreign_university', 'Tokyo', NULL, 'JP', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Waseda University', '{}'::text[], 'foreign_university', 'Tokyo', NULL, 'JP', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Keio University', '{}'::text[], 'foreign_university', 'Tokyo', NULL, 'JP', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Yonsei University', '{}'::text[], 'foreign_university', 'Seoul', NULL, 'KR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Korea University', '{}'::text[], 'foreign_university', 'Seoul', NULL, 'KR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hanyang University', '{}'::text[], 'foreign_university', 'Seoul', NULL, 'KR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Tsinghua University', '{}'::text[], 'foreign_university', 'Beijing', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Peking University', '{}'::text[], 'foreign_university', 'Beijing', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Fudan University', '{}'::text[], 'foreign_university', 'Shanghai', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Shanghai Jiao Tong University', '{}'::text[], 'foreign_university', 'Shanghai', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Zhejiang University', '{}'::text[], 'foreign_university', 'Hangzhou', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Science and Technology of China', '{}'::text[], 'foreign_university', 'Hefei', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Chinese Academy of Sciences', '{}'::text[], 'foreign_university', 'Beijing', NULL, 'CN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Hong Kong', '{}'::text[], 'foreign_university', 'Hong Kong', NULL, 'HK', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Hong Kong Polytechnic University', '{}'::text[], 'foreign_university', 'Hong Kong', NULL, 'HK', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chinese University of Hong Kong', '{}'::text[], 'foreign_university', 'Hong Kong', NULL, 'HK', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('City University of Hong Kong', '{}'::text[], 'foreign_university', 'Hong Kong', NULL, 'HK', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Taiwan University', '{}'::text[], 'foreign_university', 'Taipei', NULL, 'TW', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Tsing Hua University', '{}'::text[], 'foreign_university', 'Hsinchu', NULL, 'TW', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Yang Ming Chiao Tung University', '{}'::text[], 'foreign_university', 'Hsinchu', NULL, 'TW', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Malaya', '{}'::text[], 'foreign_university', 'Kuala Lumpur', NULL, 'MY', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Universiti Teknologi Malaysia', '{}'::text[], 'foreign_university', 'Johor Bahru', NULL, 'MY', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Universiti Putra Malaysia', '{}'::text[], 'foreign_university', 'Serdang', NULL, 'MY', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Chulalongkorn University', '{}'::text[], 'foreign_university', 'Bangkok', NULL, 'TH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mahidol University', '{}'::text[], 'foreign_university', 'Nakhon Pathom', NULL, 'TH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the Philippines Diliman', '{}'::text[], 'foreign_university', 'Quezon City', NULL, 'PH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Helsinki', '{}'::text[], 'foreign_university', 'Helsinki', NULL, 'FI', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Aalto University', '{}'::text[], 'foreign_university', 'Espoo', NULL, 'FI', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('KTH Royal Institute of Technology', '{}'::text[], 'foreign_university', 'Stockholm', NULL, 'SE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Lund University', '{}'::text[], 'foreign_university', 'Lund', NULL, 'SE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Uppsala University', '{}'::text[], 'foreign_university', 'Uppsala', NULL, 'SE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Oslo', '{}'::text[], 'foreign_university', 'Oslo', NULL, 'NO', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Norwegian University of Science and Technology', '{}'::text[], 'foreign_university', 'Trondheim', NULL, 'NO', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Iceland', '{}'::text[], 'foreign_university', 'Reykjavik', NULL, 'IS', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Warsaw', '{}'::text[], 'foreign_university', 'Warsaw', NULL, 'PL', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Jagiellonian University', '{}'::text[], 'foreign_university', 'Kraków', NULL, 'PL', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Charles University', '{}'::text[], 'foreign_university', 'Prague', NULL, 'CZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Czech Technical University in Prague', '{}'::text[], 'foreign_university', 'Prague', NULL, 'CZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Vienna', '{}'::text[], 'foreign_university', 'Vienna', NULL, 'AT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Vienna University of Technology', '{}'::text[], 'foreign_university', 'Vienna', NULL, 'AT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Barcelona', '{}'::text[], 'foreign_university', 'Barcelona', NULL, 'ES', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Autonomous University of Barcelona', '{}'::text[], 'foreign_university', 'Barcelona', NULL, 'ES', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Complutense University of Madrid', '{}'::text[], 'foreign_university', 'Madrid', NULL, 'ES', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Sapienza University of Rome', '{}'::text[], 'foreign_university', 'Rome', NULL, 'IT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Politecnico di Milano', '{}'::text[], 'foreign_university', 'Milan', NULL, 'IT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Pisa', '{}'::text[], 'foreign_university', 'Pisa', NULL, 'IT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Trinity College Dublin', '{}'::text[], 'foreign_university', 'Dublin', NULL, 'IE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University College Dublin', '{}'::text[], 'foreign_university', 'Dublin', NULL, 'IE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Lisbon', '{}'::text[], 'foreign_university', 'Lisbon', NULL, 'PT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Porto', '{}'::text[], 'foreign_university', 'Porto', NULL, 'PT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Cape Town', '{}'::text[], 'foreign_university', 'Cape Town', NULL, 'ZA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the Witwatersrand', '{}'::text[], 'foreign_university', 'Johannesburg', NULL, 'ZA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Stellenbosch University', '{}'::text[], 'foreign_university', 'Stellenbosch', NULL, 'ZA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Pretoria', '{}'::text[], 'foreign_university', 'Pretoria', NULL, 'ZA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Johannesburg', '{}'::text[], 'foreign_university', 'Johannesburg', NULL, 'ZA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Cairo University', '{}'::text[], 'foreign_university', 'Giza', NULL, 'EG', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('American University in Cairo', '{}'::text[], 'foreign_university', 'Cairo', NULL, 'EG', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ain Shams University', '{}'::text[], 'foreign_university', 'Cairo', NULL, 'EG', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Nairobi', '{}'::text[], 'foreign_university', 'Nairobi', NULL, 'KE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kenyatta University', '{}'::text[], 'foreign_university', 'Nairobi', NULL, 'KE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Ghana', '{}'::text[], 'foreign_university', 'Accra', NULL, 'GH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Kwame Nkrumah University of Science and Technology', '{}'::text[], 'foreign_university', 'Kumasi', NULL, 'GH', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Lagos', '{}'::text[], 'foreign_university', 'Lagos', NULL, 'NG', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Ibadan', '{}'::text[], 'foreign_university', 'Ibadan', NULL, 'NG', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Ahmadu Bello University', '{}'::text[], 'foreign_university', 'Zaria', NULL, 'NG', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Rwanda', '{}'::text[], 'foreign_university', 'Kigali', NULL, 'RW', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Addis Ababa University', '{}'::text[], 'foreign_university', 'Addis Ababa', NULL, 'ET', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Dar es Salaam', '{}'::text[], 'foreign_university', 'Dar es Salaam', NULL, 'TZ', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Tunis', '{}'::text[], 'foreign_university', 'Tunis', NULL, 'TN', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Mohammed V University', '{}'::text[], 'foreign_university', 'Rabat', NULL, 'MA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('King Saud University', '{}'::text[], 'foreign_university', 'Riyadh', NULL, 'SA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('King Abdulaziz University', '{}'::text[], 'foreign_university', 'Jeddah', NULL, 'SA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Qatar University', '{}'::text[], 'foreign_university', 'Doha', NULL, 'QA', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('United Arab Emirates University', '{}'::text[], 'foreign_university', 'Al Ain', NULL, 'AE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('American University of Beirut', '{}'::text[], 'foreign_university', 'Beirut', NULL, 'LB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of São Paulo', '{}'::text[], 'foreign_university', 'São Paulo', NULL, 'BR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('State University of Campinas', '{}'::text[], 'foreign_university', 'Campinas', NULL, 'BR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Federal University of Rio de Janeiro', '{}'::text[], 'foreign_university', 'Rio de Janeiro', NULL, 'BR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Pontifical Catholic University of Chile', '{}'::text[], 'foreign_university', 'Santiago', NULL, 'CL', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Chile', '{}'::text[], 'foreign_university', 'Santiago', NULL, 'CL', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National Autonomous University of Mexico', '{}'::text[], 'foreign_university', 'Mexico City', NULL, 'MX', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('Monterrey Institute of Technology', '{}'::text[], 'foreign_university', 'Monterrey', NULL, 'MX', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Buenos Aires', '{}'::text[], 'foreign_university', 'Buenos Aires', NULL, 'AR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the Andes, Colombia', '{}'::text[], 'foreign_university', 'Bogotá', NULL, 'CO', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('National University of Colombia', '{}'::text[], 'foreign_university', 'Bogotá', NULL, 'CO', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Costa Rica', '{}'::text[], 'foreign_university', 'San José', NULL, 'CR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Havana', '{}'::text[], 'foreign_university', 'Havana', NULL, 'CU', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the West Indies, Mona', '{}'::text[], 'foreign_university', 'Mona', NULL, 'JM', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the West Indies, St. Augustine', '{}'::text[], 'foreign_university', 'St. Augustine', NULL, 'TT', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the West Indies, Cave Hill', '{}'::text[], 'foreign_university', 'Cave Hill', NULL, 'BB', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of Puerto Rico, Río Piedras', '{}'::text[], 'foreign_university', 'San Juan', NULL, 'PR', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
--> statement-breakpoint
INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES ('University of the Andes, Venezuela', '{}'::text[], 'foreign_university', 'Mérida', NULL, 'VE', NULL, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");
