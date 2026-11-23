// Builds idempotent upsert SQL for the academic catalogue. Used to generate
// migration 0010 and by `npm run db:seed:academic` to apply later edits.
import { DEGREES, INSTITUTIONS, SPECIALIZATIONS, type SeedInstitution } from "./academic-catalog";

const lit = (v: string | null) => (v === null ? "NULL" : `'${v.replace(/'/g, "''")}'`);
const arr = (values: string[]) => (values.length ? `ARRAY[${values.map(lit).join(", ")}]::text[]` : `'{}'::text[]`);

export function academicSeedStatements(): string[] {
  const degrees = DEGREES.map(
    (d, i) => `INSERT INTO "degrees" ("canonical_name", "aliases", "level", "duration_years", "sort_order")
VALUES (${lit(d.name)}, ${arr(d.aliases)}, ${lit(d.level)}, ${d.duration ?? "NULL"}, ${i})
ON CONFLICT ("canonical_name") DO UPDATE SET "aliases" = EXCLUDED."aliases", "level" = EXCLUDED."level",
  "duration_years" = EXCLUDED."duration_years", "sort_order" = EXCLUDED."sort_order";`,
  );
  const specializations = SPECIALIZATIONS.map(
    (s, i) => `INSERT INTO "specializations" ("canonical_name", "aliases", "applicable_degree_ids", "sort_order")
VALUES (${lit(s.name)}, ${arr(s.aliases)}, ARRAY(SELECT "id" FROM "degrees" WHERE "canonical_name" = ANY(${arr(s.degrees)}) ORDER BY "sort_order"), ${i})
ON CONFLICT ("canonical_name") DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "applicable_degree_ids" = EXCLUDED."applicable_degree_ids", "sort_order" = EXCLUDED."sort_order";`,
  );
  return [...degrees, ...specializations, ...institutionSeedStatements(INSTITUTIONS)];
}

export function institutionSeedStatements(list: SeedInstitution[]): string[] {
  return list.map(
    (x) => `INSERT INTO "institutions" ("canonical_name", "aliases", "institution_type", "city", "state", "country_code", "website", "verification_status", "source")
VALUES (${lit(x.name)}, ${arr(x.aliases)}, ${lit(x.type)}, ${lit(x.city)}, ${lit(x.state)}, ${lit(x.country)}, ${lit(x.website)}, 'verified', 'seed')
ON CONFLICT (lower("canonical_name")) WHERE "verification_status" = 'verified' DO UPDATE SET "aliases" = EXCLUDED."aliases",
  "institution_type" = EXCLUDED."institution_type", "city" = EXCLUDED."city", "state" = EXCLUDED."state",
  "country_code" = EXCLUDED."country_code", "website" = COALESCE(EXCLUDED."website", "institutions"."website");`,
  );
}
