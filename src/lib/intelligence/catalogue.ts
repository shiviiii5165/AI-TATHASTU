import "server-only";

import { sql, type SQL } from "drizzle-orm";

import { db } from "@/db";
import type { IntelligenceDoc } from "@/lib/dashboard/types";

import { parseReportedGrade } from "./grade";
import type { BenchmarkDef, CohortFilter, SignalMatrix, SignalValue, Verification } from "./types";

// ─── Benchmark catalogue ─────────────────────────────────────────────────────
// Two kinds of benchmark:
//  • Measurements: each needs its own query, so it is code. These measure *kinds of evidence* (contributions, verified
//    certifications, ORCID publications…), never a particular technology or career.
//  • Skills: one benchmark per row of the `skills` table, read at request time. The skill list grows with the data
//    (the engine adds every skill it meets), so nothing here names a skill.
// Each value carries how it was obtained (Verification) so a ranking can refuse weak evidence.

export const MEASUREMENTS: BenchmarkDef[] = [
  // Skills, aggregated from the career engine's per-skill assessment.
  { key: "skills.assessed_count", family: "Skills", label: "Skills at Working level or above", unit: "skills", scale: "count", verification: "engine", source: "Career engine", defaultNormalization: "percentile",
    description: "Number of skills the career engine rates Working (25/100) or higher from the student's evidence. A listed skill alone never earns a level." },
  { key: "skills.mean_proficiency", family: "Skills", label: "Mean assessed skill proficiency", unit: "/100", scale: "percent", verification: "engine", source: "Career engine", defaultNormalization: "absolute",
    description: "Average 0–100 proficiency over every skill the engine could assess. Not assessed skills are left out, not counted as 0." },
  { key: "readiness.eris", family: "Career readiness", label: "ERIS readiness for primary goal", unit: "/100", scale: "percent", verification: "engine", source: "ERIS (eris_scores)", defaultNormalization: "absolute",
    description: "ERIS for the student's primary career goal: technical fit, problem solving and relevant projects. Absent when the engine had nothing to base it on. Frameworks are draft/unreviewed." },

  { key: "github.contributions_year", family: "Code & engineering", label: "GitHub contributions (last year)", unit: "contributions", scale: "count", verification: "verified", source: "GitHub (OAuth)", defaultNormalization: "percentile",
    description: "Contributions in GitHub's calendar for the synced year, read from the student's authorised GitHub account." },
  { key: "github.active_days", family: "Code & engineering", label: "Active coding days (last year)", unit: "days", scale: "count", verification: "verified", source: "GitHub (OAuth)", defaultNormalization: "percentile",
    description: "Days with at least one contribution: consistency rather than volume." },
  { key: "github.repositories", family: "Code & engineering", label: "Repositories", unit: "repos", scale: "count", verification: "verified", source: "GitHub (OAuth)", defaultNormalization: "percentile",
    description: "Repositories synced from the student's GitHub account." },
  { key: "github.stars", family: "Code & engineering", label: "Stars received", unit: "stars", scale: "count", verification: "verified", source: "GitHub (OAuth)", defaultNormalization: "percentile",
    description: "Total stars on the student's repositories: a signal of use by others." },
  { key: "github.repo_impact", family: "Code & engineering", label: "Mean repository impact (AI-assessed)", unit: "/100", scale: "percent", verification: "ai_assessed", source: "Repository scorer (LLM)", defaultNormalization: "absolute",
    description: "Average impact score a language model gave the student's repositories (metadata-only heuristic estimates are left out). A judgement, not a measurement: exclude with the evidence policy if needed." },

  { key: "problem.leetcode_weighted", family: "Problem solving", label: "LeetCode weighted solves", unit: "points", scale: "count", verification: "external", source: "LeetCode public profile", defaultNormalization: "percentile",
    description: "Solved problems weighted easy 1, medium 2, hard 3, from the student's public LeetCode profile." },
  { key: "problem.hackerrank_stars", family: "Problem solving", label: "HackerRank problem-solving stars", unit: "/5", scale: "count", verification: "external", source: "HackerRank public profile", defaultNormalization: "target", defaultTarget: 5,
    description: "Stars on HackerRank's Problem Solving badge (0–5)." },

  { key: "projects.corroborated", family: "Projects", label: "Projects corroborated by code", unit: "projects", scale: "count", verification: "verified", source: "Unified projects (resume ↔ GitHub)", defaultNormalization: "percentile",
    description: "Projects the student described that were matched to a repository of theirs." },
  { key: "projects.total", family: "Projects", label: "Projects described", unit: "projects", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Distinct projects the student describes on their resume or profile, including entries awaiting their review. Repositories are counted separately under Code & engineering." },
  { key: "research.patents", family: "Research", label: "Patents mentioned", unit: "entries", scale: "count", verification: "self_reported", source: "Resume / profile (any section)", defaultNormalization: "target", defaultTarget: 1,
    description: "Distinct entries anywhere on the resume or profile that mention a patent. Filed and granted aren't distinguished yet; treat as a lead to verify." },
  { key: "experience.internships", family: "Experience", label: "Internships", unit: "internships", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Experience entries that are internships (named as such in the role, organisation or description)." },
  { key: "achievements.competitions", family: "Achievements", label: "Competition results", unit: "results", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Achievements describing a competition outcome: hackathons, olympiads, contests, wins, finalist or ranked placements." },

  { key: "credentials.verified_certifications", family: "Credentials", label: "Verified certifications", unit: "certs", scale: "count", verification: "verified", source: "Learning records (verified)", defaultNormalization: "percentile",
    description: "Certifications whose verification is recorded as verified." },
  { key: "credentials.listed_certifications", family: "Credentials", label: "Certifications listed", unit: "certs", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Certifications the student lists on their resume or profile. Unchecked." },

  { key: "research.publications_orcid", family: "Research", label: "Publications on ORCID", unit: "works", scale: "count", verification: "external", source: "ORCID", defaultNormalization: "percentile",
    description: "Works read from the student's ORCID record." },
  { key: "research.publications_listed", family: "Research", label: "Publications listed", unit: "works", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Publications the student lists on their resume or profile (ORCID works excluded so the same paper isn't counted twice)." },

  { key: "experience.positions", family: "Experience", label: "Internships & positions", unit: "positions", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Distinct experience entries (internships, jobs, positions of responsibility) on the resume or profile." },
  { key: "achievements.listed", family: "Achievements", label: "Achievements & awards", unit: "items", scale: "count", verification: "self_reported", source: "Resume / profile", defaultNormalization: "percentile",
    description: "Distinct achievements (hackathons, awards, scholarships…) listed by the student." },

  { key: "academic.reported_grade", family: "Academics", label: "Reported grade (% of its scale)", unit: "%", scale: "percent", verification: "self_reported", source: "Resume education entry", defaultNormalization: "absolute",
    description: "The most recent grade on the resume converted to a percentage of its stated scale (8.6/10 → 86, 3.4/4 → 85). Only grades with a clear scale are used. No institution feed exists yet." },

  { key: "learning.courses_completed", family: "Learning", label: "Courses completed", unit: "courses", scale: "count", verification: "self_reported", source: "Learning records", defaultNormalization: "percentile",
    description: "Courses marked completed. Completion is learning activity, never proficiency." },
  { key: "learning.milestone_evidence", family: "Learning", label: "Roadmap milestone evidence", unit: "submissions", scale: "count", verification: "self_reported", source: "Roadmap submissions", defaultNormalization: "percentile",
    description: "Evidence links the student submitted for roadmap milestones." },

  { key: "engagement.applications_confirmed", family: "Platform engagement", label: "Applications confirmed", unit: "applications", scale: "count", verification: "self_reported", source: "Opportunity interactions", defaultNormalization: "percentile",
    description: "Opportunities the student confirmed applying to. Activity, not ability." },
  { key: "engagement.opportunities_saved", family: "Platform engagement", label: "Opportunities saved", unit: "saves", scale: "count", verification: "verified", source: "Opportunity saves", defaultNormalization: "percentile",
    description: "Opportunities saved on the platform. Activity, not ability." },
];

export const SKILL_FAMILY = "Individual skills";
export const skillKey = (skillId: string) => `skill:${skillId}`;

export interface CatalogueSkill {
  id: string;
  name: string;
  category: string;
}

export async function loadSkillCatalogue(): Promise<CatalogueSkill[]> {
  const { rows } = await db.execute(sql`SELECT id::text AS id, canonical_name AS name, category FROM skills ORDER BY canonical_name`);
  return rows as unknown as CatalogueSkill[];
}

export function skillBenchmark(s: CatalogueSkill): BenchmarkDef {
  return {
    key: skillKey(s.id),
    family: SKILL_FAMILY,
    label: s.name,
    description: `Career-engine proficiency in ${s.name} (0–100). Its verification follows the strongest evidence behind it.`,
    unit: "/100",
    scale: "percent",
    verification: "engine",
    source: "Career engine",
    defaultNormalization: "absolute",
  };
}

export async function loadCatalogue(): Promise<{ list: BenchmarkDef[]; byKey: Map<string, BenchmarkDef>; skills: CatalogueSkill[] }> {
  const skills = await loadSkillCatalogue();
  const list = [...MEASUREMENTS, ...skills.map(skillBenchmark)];
  return { list, byKey: new Map(list.map((b) => [b.key, b])), skills };
}

// ─── Cohort ──────────────────────────────────────────────────────────────────

/** WHERE clause over `users u` (and `onboarding_state os` for the career goal). Students only; deleted accounts never. */
export function cohortWhere(c: CohortFilter, search?: string): SQL {
  const parts: SQL[] = [sql`u.role = 'student'`, sql`u.deleted_at IS NULL`];
  if (c.institutionId) parts.push(sql`u.institution_id = ${c.institutionId}::uuid`);
  if (c.degreeId) parts.push(sql`u.degree_id = ${c.degreeId}::uuid`);
  if (c.specializationId) parts.push(sql`u.specialization_id = ${c.specializationId}::uuid`);
  if (c.academicYear) parts.push(sql`coalesce(u.current_academic_year, u.academic_year) = ${c.academicYear}`);
  if (c.graduationYear && /^\d{4}$/.test(c.graduationYear)) parts.push(sql`u.expected_graduation_year = ${Number(c.graduationYear)}`);
  if (c.careerRole) parts.push(sql`os.career_role = ${c.careerRole}`);
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    parts.push(sql`(u.name ILIKE ${q} OR u.email ILIKE ${q} OR u.id::text = ${search.trim()})`);
  }
  return sql.join(parts, sql` AND `);
}

export interface CohortStudent {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  university: string | null;
  degree: string | null;
  specialization: string | null;
  academicYear: string | null;
  careerRole: string | null;
  viewUpdatedAt: string | null;
}

export async function loadCohort(c: CohortFilter): Promise<CohortStudent[]> {
  const { rows } = await db.execute(sql`
    SELECT u.id::text AS id, u.name, u.email, u.avatar_url AS image, u.university, u.degree, u.specialization,
           coalesce(u.current_academic_year, u.academic_year) AS "academicYear", os.career_role AS "careerRole",
           pv.updated_at AS "viewUpdatedAt"
    FROM users u
    LEFT JOIN onboarding_state os ON os.user_id = u.id
    LEFT JOIN profile_views pv ON pv.user_id = u.id
    WHERE ${cohortWhere(c)}
    ORDER BY u.created_at`);
  return rows as unknown as CohortStudent[];
}

// ─── Signals ─────────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const num = (v: unknown): number | null => {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Evidence basis of an engine skill → how far its proficiency can be trusted. "inferred" never gets a value. */
export function verificationOfBasis(basis: string | undefined, evidenceState: string | undefined): Verification | null {
  switch (basis) {
    case "demonstrated": return "verified";
    case "assessed": return "external";
    case "detected":
    case "repository_mention": return "engine";
    case "described":
    case "claimed": return "self_reported";
    case "inferred":
    case "not_found": return null;
  }
  if (evidenceState === "demonstrated") return "verified";
  if (evidenceState === "unverified") return "self_reported";
  return "engine";
}

/**
 * Every benchmark value for a cohort, in one grouped query per evidence table (no per-student round trips).
 * `cohort` restricts the users; pass the same filter used for loadCohort.
 */
export async function loadSignals(c: CohortFilter, skills: CatalogueSkill[]): Promise<SignalMatrix> {
  const where = cohortWhere(c);
  const ids = sql`(SELECT u.id FROM users u LEFT JOIN onboarding_state os ON os.user_id = u.id WHERE ${where})`;
  const m: SignalMatrix = new Map();
  const put = (userId: string, key: string, v: SignalValue) => {
    let row = m.get(userId);
    if (!row) m.set(userId, (row = new Map()));
    row.set(key, v);
  };
  const skillIdByName = new Map(skills.map((s) => [s.name.toLowerCase(), s.id]));

  const [views, eris, gh, repos, impact, facts, grades, projects, learning, milestones, interactions, saves, textual] = await Promise.all([
    // The admin view (view.admin) also counts resume facts awaiting the student's review; fall back to the student's own.
    db.execute(sql`SELECT user_id::text AS u, coalesce(view->'admin'->'intelligence'->'skills', view->'intelligence'->'skills') AS skills,
                     (view->'admin'->>'basis') = 'includes_unreviewed' AS unreviewed FROM profile_views WHERE user_id IN ${ids}`),
    db.execute(sql`SELECT os.user_id::text AS u, coalesce((pv.view->'admin'->'eris'->>os.career_role)::float, e.score) AS score,
                     (pv.view->'admin'->'eris' ? os.career_role) AS unreviewed
                   FROM onboarding_state os
                   LEFT JOIN eris_scores e ON e.user_id = os.user_id AND e.role = os.career_role
                   LEFT JOIN profile_views pv ON pv.user_id = os.user_id
                   WHERE os.user_id IN ${ids} AND os.career_role IS NOT NULL`),
    db.execute(sql`SELECT user_id::text AS u, total_contributions AS total,
                     (SELECT count(*) FROM jsonb_array_elements(coalesce(days, '[]'::jsonb)) d WHERE (d->>'count')::int > 0) AS active
                   FROM github_contributions WHERE synced_at IS NOT NULL AND user_id IN ${ids}`),
    db.execute(sql`SELECT user_id::text AS u, count(*) AS n, coalesce(sum(stars), 0) AS stars FROM code_repositories WHERE user_id IN ${ids} GROUP BY user_id`),
    // Only language-model judgements: scores whose rationale marks them as the metadata heuristic are a different
    // (weaker) measurement and would be mislabelled as AI-assessed.
    db.execute(sql`SELECT user_id::text AS u, avg(impact_score) AS avg, count(*) AS n FROM github_scores
                   WHERE user_id IN ${ids} AND rationale NOT LIKE 'Estimated from repository metadata%' GROUP BY user_id`),
    // Distinct entries (record_key) per group and origin, current and not rejected.
    db.execute(sql`SELECT user_id::text AS u, field_group AS g, origin, count(DISTINCT coalesce(record_key, id::text)) AS n
                   FROM profile_facts
                   WHERE superseded_by IS NULL AND confirmation <> 'rejected' AND user_id IN ${ids}
                     AND field_group IN ('certifications', 'publications', 'experience', 'achievements')
                     -- Connector stat rows (LeetCode/HackerRank badges, GitHub) also land in these groups; they are
                     -- measured by their own benchmarks and are not things the student listed.
                     AND origin NOT IN ('leetcode', 'hackerrank', 'github', 'kaggle', 'stack_exchange')
                   GROUP BY user_id, field_group, origin`),
    db.execute(sql`SELECT DISTINCT ON (g.user_id) g.user_id::text AS u, g.extracted_value AS grade, g.normalized_value AS norm
                   FROM profile_facts g
                   LEFT JOIN profile_facts e ON e.user_id = g.user_id AND e.record_key = g.record_key AND e.field_group = 'education'
                     AND e.field_name = 'end_date' AND e.superseded_by IS NULL
                   WHERE g.field_group = 'education' AND g.field_name = 'grade' AND g.superseded_by IS NULL
                     AND g.confirmation <> 'rejected' AND g.user_id IN ${ids}
                   ORDER BY g.user_id, (e.extracted_value #>> '{}') DESC NULLS LAST, g.created_at DESC`),
    // Projects: described entries from every self-reported origin (reviewed or not), and code corroboration from the
    // admin matcher (which also sees unreviewed resume projects), else the student's own unified projects.
    db.execute(sql`SELECT u.id::text AS u,
                     (SELECT count(DISTINCT coalesce(f.record_key, f.id::text)) FROM profile_facts f
                       WHERE f.user_id = u.id AND f.field_group = 'projects' AND f.superseded_by IS NULL AND f.confirmation <> 'rejected'
                         AND f.origin NOT IN ('github', 'leetcode', 'hackerrank', 'kaggle', 'stack_exchange')) AS described,
                     coalesce((pv.view->'admin'->'projects'->>'matched')::int,
                              (SELECT count(*) FROM unified_projects up WHERE up.user_id = u.id AND up.status = 'matched')) AS matched
                   FROM users u LEFT JOIN profile_views pv ON pv.user_id = u.id
                   WHERE u.id IN ${ids}`),
    db.execute(sql`SELECT user_id::text AS u,
                     count(*) FILTER (WHERE kind = 'course' AND status = 'completed') AS courses,
                     count(*) FILTER (WHERE kind = 'certification' AND verification = 'verified') AS verified_certs
                   FROM learning_records WHERE deleted_at IS NULL AND user_id IN ${ids} GROUP BY user_id`),
    db.execute(sql`SELECT user_id::text AS u, count(*) AS n FROM roadmap_milestone_submissions WHERE user_id IN ${ids} GROUP BY user_id`),
    db.execute(sql`SELECT user_id::text AS u, count(DISTINCT opportunity_id) AS n FROM opportunity_interactions WHERE kind = 'confirmed_applied' AND user_id IN ${ids} GROUP BY user_id`),
    db.execute(sql`SELECT user_id::text AS u, count(*) AS n FROM opportunity_saves WHERE user_id IN ${ids} GROUP BY user_id`),
    // Evidence that lives inside free text of any entry: internships (in experience or elsewhere), patents (usually written
    // under achievements or projects), competition results. One count per distinct entry, never per field.
    db.execute(sql`SELECT f.user_id::text AS u,
                     count(DISTINCT f.field_group || ':' || coalesce(f.record_key, f.id::text)) FILTER (
                       WHERE f.field_group = 'experience' AND t ~* '\\mintern(ship)?s?\\M') AS internships,
                     count(DISTINCT f.field_group || ':' || coalesce(f.record_key, f.id::text)) FILTER (
                       WHERE t ~* '\\mpatent(s|ed)?\\M') AS patents,
                     count(DISTINCT f.field_group || ':' || coalesce(f.record_key, f.id::text)) FILTER (
                       WHERE f.field_group = 'achievements' AND t ~* '(hackathon|olympiad|competition|contest|challenge|winner|won|finalist|runner[- ]?up|\\m(1st|2nd|3rd|first|second|third) (place|prize|position)\\M|\\mrank(ed)? ?#?[0-9])') AS competitions
                   FROM (SELECT user_id, field_group, record_key, id, coalesce(normalized_value, extracted_value)::text AS t
                           FROM profile_facts
                          WHERE superseded_by IS NULL AND confirmation <> 'rejected' AND user_id IN ${ids}
                            AND origin NOT IN ('github', 'leetcode', 'hackerrank', 'kaggle', 'stack_exchange')) f
                   GROUP BY f.user_id`),
  ]);

  // Engine skills → per-skill benchmarks + aggregates.
  for (const r of views.rows as Row[]) {
    const list = Array.isArray(r.skills) ? (r.skills as IntelligenceDoc["skills"]) : [];
    const assessed: number[] = [];
    for (const s of list) {
      if (!s || typeof s.name !== "string" || s.proficiency === null || s.proficiency === undefined) continue;
      const v = verificationOfBasis(s.evidenceBasis, s.evidenceState);
      if (!v) continue;
      assessed.push(s.proficiency);
      const id = skillIdByName.get(s.name.toLowerCase());
      if (id) put(r.u as string, skillKey(id), { value: s.proficiency, verification: v, source: s.levelBasis?.[0] ?? `Career engine (${s.level})` });
    }
    if (assessed.length) {
      put(r.u as string, "skills.assessed_count", { value: assessed.filter((p) => p >= 25).length, verification: "engine", source: `${assessed.length} assessed skills` });
      put(r.u as string, "skills.mean_proficiency", { value: assessed.reduce((a, b) => a + b, 0) / assessed.length, verification: "engine", source: `Mean of ${assessed.length} assessed skills` });
    }
  }
  for (const r of eris.rows as Row[]) {
    const s = num(r.score);
    if (s !== null) put(r.u as string, "readiness.eris", { value: s * 100, verification: "engine", source: r.unreviewed ? "ERIS for primary goal (includes resume facts awaiting review)" : "ERIS for primary goal" });
  }
  for (const r of gh.rows as Row[]) {
    const t = num(r.total);
    if (t !== null) put(r.u as string, "github.contributions_year", { value: t, verification: "verified", source: "GitHub contribution calendar" });
    const a = num(r.active);
    if (a !== null) put(r.u as string, "github.active_days", { value: a, verification: "verified", source: "GitHub contribution calendar" });
  }
  for (const r of repos.rows as Row[]) {
    put(r.u as string, "github.repositories", { value: num(r.n) ?? 0, verification: "verified", source: "Synced repositories" });
    put(r.u as string, "github.stars", { value: num(r.stars) ?? 0, verification: "verified", source: "Synced repositories" });
  }
  for (const r of impact.rows as Row[]) {
    const a = num(r.avg);
    if (a !== null) put(r.u as string, "github.repo_impact", { value: a, verification: "ai_assessed", source: `${num(r.n)} repositories scored by the repository scorer` });
  }
  const factCounts = new Map<string, Map<string, number>>();
  for (const r of facts.rows as Row[]) {
    const u = r.u as string;
    const g = r.g as string;
    const n = num(r.n) ?? 0;
    const key =
      g === "publications" ? (r.origin === "orcid" ? "research.publications_orcid" : "research.publications_listed")
      : g === "certifications" ? "credentials.listed_certifications"
      : g === "experience" ? "experience.positions"
      : "achievements.listed";
    let row = factCounts.get(u);
    if (!row) factCounts.set(u, (row = new Map()));
    row.set(key, (row.get(key) ?? 0) + n);
  }
  for (const [u, row] of factCounts) {
    for (const [key, n] of row) {
      put(u, key, { value: n, verification: key === "research.publications_orcid" ? "external" : "self_reported", source: key === "research.publications_orcid" ? "ORCID record" : "Resume / profile entries" });
    }
  }
  for (const r of grades.rows as Row[]) {
    const g = parseReportedGrade(r.norm ?? r.grade);
    if (g) put(r.u as string, "academic.reported_grade", { value: g.percent, verification: "self_reported", source: `Resume grade "${g.text}"` });
  }
  const hasRepos = new Set((repos.rows as Row[]).map((r) => r.u as string));
  for (const r of projects.rows as Row[]) {
    const described = num(r.described) ?? 0;
    // Only recorded when it means something: no described project is "no evidence", not 0 projects.
    if (described > 0) put(r.u as string, "projects.total", { value: described, verification: "self_reported", source: "Projects on resume / profile (reviewed or awaiting review)" });
    // Corroboration is only measurable when there is something to corroborate against.
    if (described > 0 && hasRepos.has(r.u as string))
      put(r.u as string, "projects.corroborated", { value: num(r.matched) ?? 0, verification: "verified", source: "Described projects matched by name to the student's own repositories" });
  }
  for (const r of textual.rows as Row[]) {
    const intern = num(r.internships) ?? 0;
    if (intern > 0) put(r.u as string, "experience.internships", { value: intern, verification: "self_reported", source: "Experience entries naming an internship" });
    const pat = num(r.patents) ?? 0;
    if (pat > 0) put(r.u as string, "research.patents", { value: pat, verification: "self_reported", source: "Entries mentioning a patent (filed or granted not distinguished)" });
    const comp = num(r.competitions) ?? 0;
    if (comp > 0) put(r.u as string, "achievements.competitions", { value: comp, verification: "self_reported", source: "Achievements describing a competition result" });
  }
  for (const r of learning.rows as Row[]) {
    const c = num(r.courses) ?? 0;
    if (c > 0) put(r.u as string, "learning.courses_completed", { value: c, verification: "self_reported", source: "Learning records" });
    const v = num(r.verified_certs) ?? 0;
    if (v > 0) put(r.u as string, "credentials.verified_certifications", { value: v, verification: "verified", source: "Verified learning records" });
  }
  for (const r of milestones.rows as Row[]) put(r.u as string, "learning.milestone_evidence", { value: num(r.n) ?? 0, verification: "self_reported", source: "Roadmap submissions" });
  for (const r of interactions.rows as Row[]) put(r.u as string, "engagement.applications_confirmed", { value: num(r.n) ?? 0, verification: "self_reported", source: "Confirmed applications" });
  for (const r of saves.rows as Row[]) put(r.u as string, "engagement.opportunities_saved", { value: num(r.n) ?? 0, verification: "verified", source: "Saved opportunities" });

  // Coding platforms: stats facts (record_key leetcode:stats / hackerrank:stats).
  const { rows: coding } = await db.execute(sql`
    SELECT user_id::text AS u, record_key AS k, extracted_value AS v FROM profile_facts
    WHERE superseded_by IS NULL AND record_key IN ('leetcode:stats', 'hackerrank:stats') AND user_id IN ${ids}`);
  for (const r of coding as Row[]) {
    const v = (r.v ?? {}) as Record<string, unknown>;
    if (r.k === "leetcode:stats") {
      const parts = [num(v.easy), num(v.medium), num(v.hard)];
      if (parts.every((p) => p === null)) continue; // unknown, not zero
      const w = (parts[0] ?? 0) + 2 * (parts[1] ?? 0) + 3 * (parts[2] ?? 0);
      put(r.u as string, "problem.leetcode_weighted", { value: w, verification: "external", source: `LeetCode: ${parts[0] ?? 0} easy, ${parts[1] ?? 0} medium, ${parts[2] ?? 0} hard` });
    } else {
      const stars = num((v.badges as Record<string, unknown> | undefined)?.["Problem Solving"]);
      if (stars !== null) put(r.u as string, "problem.hackerrank_stars", { value: stars, verification: "external", source: "HackerRank Problem Solving badge" });
    }
  }
  return m;
}
