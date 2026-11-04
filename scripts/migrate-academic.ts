// Links existing users' free-text academic fields to the catalogue.
//
//   npm run db:migrate:academic            # dry run: shows what would change
//   npm run db:migrate:academic -- --apply # writes
//
// Only exact, unambiguous name/alias matches are linked (src/lib/academic/match.ts).
// The text columns are never changed; anything unmatched keeps its text and a
// null id, and the user picks from the list next time they edit Step 3.
// Users who already have ids are skipped, so it's safe to re-run.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

import { academicYearsFor, exactMatch } from "../src/lib/academic/match";
import { assertTestIsolation, assertWriteAllowed } from "./lib/db-target.mjs";

type Row = Record<string, unknown>;

async function connect(url: string) {
  if (/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    const { default: pg } = await import("pg");
    const pool = new pg.Pool({ connectionString: url, max: 1 });
    return { query: async (t: string, p: unknown[] = []) => (await pool.query(t, p)).rows as Row[], close: () => pool.end() };
  }
  const sql = neon(url);
  return { query: (t: string, p: unknown[] = []) => sql.query(t, p) as Promise<Row[]>, close: async () => {} };
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) config({ path: ".env.local", quiet: true });
  const { query, close } = await connect((apply ? assertWriteAllowed : assertTestIsolation)(process.env.DATABASE_URL));
  try {
    const institutions = (await query(`SELECT id, canonical_name, aliases FROM institutions WHERE verification_status = 'verified'`)).map((r) => ({
      id: String(r.id), canonicalName: String(r.canonical_name), aliases: r.aliases as string[],
    }));
    const degrees = (await query(`SELECT id, canonical_name, aliases, level, duration_years FROM degrees`)).map((r) => ({
      id: String(r.id), canonicalName: String(r.canonical_name), aliases: r.aliases as string[], level: String(r.level), durationYears: r.duration_years as number | null,
    }));
    const specs = (await query(`SELECT id, canonical_name, aliases, applicable_degree_ids FROM specializations`)).map((r) => ({
      id: String(r.id), canonicalName: String(r.canonical_name), aliases: r.aliases as string[], applicableDegreeIds: r.applicable_degree_ids as string[],
    }));
    if (!institutions.length || !degrees.length) throw new Error("The catalogue is empty: apply migration 0010 (npm run db:migrate:http) first.");

    const users = await query(
      `SELECT id, university, degree, specialization, academic_year, institution_id, degree_id, specialization_id, current_academic_year
         FROM users
        WHERE deleted_at IS NULL AND (university IS NOT NULL OR degree IS NOT NULL)
          AND (institution_id IS NULL OR degree_id IS NULL)`,
    );

    const tally = { users: users.length, institution: 0, degree: 0, specialization: 0, year: 0, unmatchedInstitution: 0, unmatchedDegree: 0 };
    for (const u of users) {
      const inst = u.institution_id ? null : exactMatch(u.university as string, institutions);
      const degree = u.degree_id ? degrees.find((d) => d.id === u.degree_id) ?? null : exactMatch(u.degree as string, degrees);
      const spec = !u.specialization_id && degree
        ? exactMatch(u.specialization as string, specs.filter((s) => s.applicableDegreeIds.includes(degree.id)))
        : null;
      const year = !u.current_academic_year && degree && academicYearsFor(degree).includes(String(u.academic_year)) ? String(u.academic_year) : null;

      if (inst) tally.institution++;
      else if (!u.institution_id && u.university) tally.unmatchedInstitution++;
      if (degree && !u.degree_id) tally.degree++;
      else if (!u.degree_id && u.degree) tally.unmatchedDegree++;
      if (spec) tally.specialization++;
      if (year) tally.year++;

      const label = (x: { canonicalName: string } | null, raw: unknown) => (x ? `${raw} → ${x.canonicalName}` : raw ? `${raw} (kept as text)` : "-");
      console.log(`${String(u.id).slice(0, 8)}  institution: ${u.institution_id ? "already linked" : label(inst, u.university)} · degree: ${u.degree_id ? "already linked" : label(degree, u.degree)}${spec ? ` · specialization: ${spec.canonicalName}` : ""}${year ? ` · year: ${year}` : ""}`);

      if (apply && (inst || (degree && !u.degree_id) || spec || year)) {
        await query(
          `UPDATE users SET
             institution_id = COALESCE(institution_id, $2), degree_id = COALESCE(degree_id, $3),
             specialization_id = COALESCE(specialization_id, $4), current_academic_year = COALESCE(current_academic_year, $5)
           WHERE id = $1`,
          [u.id, inst?.id ?? null, degree?.id ?? null, spec?.id ?? null, year],
        );
      }
    }
    console.log(`\n${apply ? "Applied" : "Dry run (add --apply to write)"}:`, tally);
    return 0;
  } finally {
    await close();
  }
}

main().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  },
);
