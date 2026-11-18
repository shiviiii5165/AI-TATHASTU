import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { careerRoleLabel } from "@/lib/onboarding/catalog";

import { cohortWhere, loadCatalogue, loadSignals, SKILL_FAMILY } from "./catalogue";
import type { BenchmarkDef, CohortFilter, Verification } from "./types";

type Row = Record<string, unknown>;
const n = (v: unknown) => Number(v ?? 0) || 0;

export interface Overview {
  totals: {
    students: number;
    withIntelligence: number;
    withConnectedSource: number;
    withGithub: number;
    withResume: number;
    rankable: number;
    newLast30: number;
  };
  coverage: { def: BenchmarkDef; students: number }[];
  skillLeaders: { label: string; students: number; mean: number }[];
  verificationMix: { verification: Verification; values: number }[];
  erisHistogram: { bucket: string; students: number }[];
  byInstitution: { label: string; students: number }[];
  byYear: { label: string; students: number }[];
  byGoal: { label: string; students: number }[];
  connectors: { label: string; students: number }[];
  registrations: { month: string; students: number }[];
  freshness: { label: string; students: number }[];
  skillCount: number;
}

export async function loadOverview(c: CohortFilter): Promise<Overview> {
  const where = cohortWhere(c);
  const base = sql`FROM users u LEFT JOIN onboarding_state os ON os.user_id = u.id WHERE ${where}`;
  const ids = sql`(SELECT u.id ${base})`;
  const { list, skills } = await loadCatalogue();

  const [totals, inst, years, goals, conns, regs, fresh, signals] = await Promise.all([
    db.execute(sql`SELECT count(*) AS students,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM profile_views pv WHERE pv.user_id = u.id AND pv.view ? 'intelligence')) AS intel,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM connections c WHERE c.user_id = u.id)) AS connected,
        count(*) FILTER (WHERE EXISTS (SELECT 1 FROM github_contributions g WHERE g.user_id = u.id AND g.synced_at IS NOT NULL)) AS github,
        count(*) FILTER (WHERE os.resume_uploaded) AS resume,
        count(*) FILTER (WHERE u.created_at > now() - interval '30 days') AS recent
      ${base}`),
    db.execute(sql`SELECT coalesce(i.canonical_name, nullif(u.university, ''), 'Not specified') AS label, count(*) AS n
      FROM users u LEFT JOIN onboarding_state os ON os.user_id = u.id LEFT JOIN institutions i ON i.id = u.institution_id
      WHERE ${where} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    db.execute(sql`SELECT coalesce(nullif(coalesce(u.current_academic_year, u.academic_year), ''), 'Not specified') AS label, count(*) AS n ${base} GROUP BY 1 ORDER BY 1`),
    db.execute(sql`SELECT os.career_role AS role, count(*) AS n ${base} GROUP BY 1 ORDER BY n DESC LIMIT 8`),
    db.execute(sql`SELECT source_id AS label, count(DISTINCT user_id) AS n FROM connections WHERE user_id IN ${ids} GROUP BY 1 ORDER BY n DESC`),
    db.execute(sql`SELECT to_char(date_trunc('month', u.created_at), 'YYYY-MM') AS m, count(*) AS n ${base}
      AND u.created_at > date_trunc('month', now()) - interval '11 months' GROUP BY 1 ORDER BY 1`),
    db.execute(sql`SELECT CASE WHEN pv.updated_at IS NULL THEN 'Never computed'
                               WHEN pv.updated_at > now() - interval '7 days' THEN 'Under 7 days'
                               WHEN pv.updated_at > now() - interval '30 days' THEN '7–30 days'
                               ELSE 'Over 30 days' END AS label, count(*) AS n
      FROM users u LEFT JOIN onboarding_state os ON os.user_id = u.id LEFT JOIN profile_views pv ON pv.user_id = u.id
      WHERE ${where} GROUP BY 1`),
    loadSignals(c, skills),
  ]);

  const t = (totals.rows as Row[])[0] ?? {};
  const keyCount = new Map<string, number>();
  const skillValues = new Map<string, number[]>();
  const mix = new Map<Verification, number>();
  let rankable = 0;
  for (const row of signals.values()) {
    if (row.size >= 3) rankable++;
    for (const [k, v] of row) {
      keyCount.set(k, (keyCount.get(k) ?? 0) + 1);
      mix.set(v.verification, (mix.get(v.verification) ?? 0) + 1);
      if (k.startsWith("skill:")) skillValues.set(k, [...(skillValues.get(k) ?? []), v.value]);
    }
  }
  const byKey = new Map(list.map((b) => [b.key, b]));
  const eris = [...signals.values()].map((r) => r.get("readiness.eris")?.value).filter((v): v is number => v !== undefined);
  const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: `${i * 10}–${i * 10 + 10}`, students: 0 }));
  for (const v of eris) buckets[Math.min(9, Math.floor(v / 10))].students++;

  // Last 12 months, including months with no registrations.
  const regMap = new Map((regs.rows as Row[]).map((r) => [String(r.m), n(r.n)]));
  const months: { month: string; students: number }[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    months.push({ month: key, students: regMap.get(key) ?? 0 });
  }

  return {
    totals: {
      students: n(t.students), withIntelligence: n(t.intel), withConnectedSource: n(t.connected), withGithub: n(t.github),
      withResume: n(t.resume), rankable, newLast30: n(t.recent),
    },
    coverage: list.filter((b) => b.family !== SKILL_FAMILY).map((def) => ({ def, students: keyCount.get(def.key) ?? 0 })),
    skillLeaders: [...skillValues.entries()]
      .map(([k, vs]) => ({ label: byKey.get(k)?.label ?? k, students: vs.filter((v) => v >= 25).length, mean: vs.reduce((a, b) => a + b, 0) / vs.length }))
      .filter((s) => s.students > 0)
      .sort((a, b) => b.students - a.students || b.mean - a.mean)
      .slice(0, 12),
    verificationMix: [...mix.entries()].map(([verification, values]) => ({ verification, values })),
    erisHistogram: buckets,
    byInstitution: (inst.rows as Row[]).map((r) => ({ label: String(r.label), students: n(r.n) })),
    byYear: (years.rows as Row[]).map((r) => ({ label: String(r.label), students: n(r.n) })),
    byGoal: (goals.rows as Row[]).map((r) => ({ label: r.role ? careerRoleLabel(String(r.role)) ?? String(r.role) : "No goal chosen", students: n(r.n) })),
    connectors: (conns.rows as Row[]).map((r) => ({ label: String(r.label), students: n(r.n) })),
    registrations: months,
    freshness: (fresh.rows as Row[]).map((r) => ({ label: String(r.label), students: n(r.n) })),
    skillCount: skills.length,
  };
}

/** Options for the cohort filters, from the data itself (only values students actually have). */
export async function loadCohortOptions() {
  const [inst, deg, spec, years, grads, goals] = await Promise.all([
    db.execute(sql`SELECT i.id::text AS id, i.canonical_name AS label, count(*) AS n FROM users u JOIN institutions i ON i.id = u.institution_id
      WHERE u.role = 'student' AND u.deleted_at IS NULL GROUP BY 1, 2 ORDER BY n DESC, 2 LIMIT 200`),
    db.execute(sql`SELECT d.id::text AS id, d.canonical_name AS label FROM users u JOIN degrees d ON d.id = u.degree_id
      WHERE u.role = 'student' AND u.deleted_at IS NULL GROUP BY 1, 2 ORDER BY 2`),
    db.execute(sql`SELECT s.id::text AS id, s.canonical_name AS label FROM users u JOIN specializations s ON s.id = u.specialization_id
      WHERE u.role = 'student' AND u.deleted_at IS NULL GROUP BY 1, 2 ORDER BY 2`),
    db.execute(sql`SELECT DISTINCT coalesce(u.current_academic_year, u.academic_year) AS v FROM users u
      WHERE u.role = 'student' AND u.deleted_at IS NULL AND coalesce(u.current_academic_year, u.academic_year) IS NOT NULL ORDER BY 1`),
    db.execute(sql`SELECT DISTINCT u.expected_graduation_year AS v FROM users u
      WHERE u.role = 'student' AND u.deleted_at IS NULL AND u.expected_graduation_year IS NOT NULL ORDER BY 1`),
    db.execute(sql`SELECT DISTINCT os.career_role AS v FROM onboarding_state os JOIN users u ON u.id = os.user_id
      WHERE u.role = 'student' AND u.deleted_at IS NULL AND os.career_role IS NOT NULL ORDER BY 1`),
  ]);
  const opt = (rows: unknown[]) => (rows as Row[]).map((r) => ({ value: String(r.id), label: String(r.label) }));
  const val = (rows: unknown[]) => (rows as Row[]).map((r) => ({ value: String(r.v), label: String(r.v) }));
  return {
    institutionId: opt(inst.rows),
    degreeId: opt(deg.rows),
    specializationId: opt(spec.rows),
    academicYear: val(years.rows),
    graduationYear: val(grads.rows),
    careerRole: (goals.rows as Row[]).map((r) => ({ value: String(r.v), label: careerRoleLabel(String(r.v)) ?? String(r.v) })),
  };
}

export type CohortOptions = Awaited<ReturnType<typeof loadCohortOptions>>;
