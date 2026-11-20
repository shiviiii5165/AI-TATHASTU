import "server-only";

import { desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { frameworkReviews, type FrameworkReviewDecision, intelligenceSnapshots } from "@/db/schema";
import data from "../../../worker/intelligence/frameworks/role_frameworks.json";
import registry from "../../../worker/intelligence/frameworks/career_roles.json";

/**
 * The career-intelligence frameworks as the worker reads them (worker/intelligence/frameworks/role_frameworks.json),
 * for the admin governance page. Read-only: a framework changes through a reviewed code change that bumps its version,
 * never at runtime, so an assessment's framework version always names exactly what it was measured against.
 */

type Level = "Foundational" | "Working" | "Proficient" | "Advanced";
export type CareerLevels = { junior: Level; intermediate: Level; senior: Level };
export type Requirement = {
  competency: string; tier: "required" | "supporting" | "specialisation"; weight: number; expectedLevel: Level;
  evidenceRequirement: "independent" | "described"; rationale?: string; track?: string; careerLevels?: CareerLevels;
};
export type Reference = {
  id: string; title: string; publisher: string; kind: string; url: string; checkedAt: string; informs: string;
  linkCheck?: { at: string; result: string }; contentCheck?: { at: string; finding: string };
};
type Competency = { category: string; domain?: string; description: string; demonstration: string; prerequisites: string[]; realises?: string; sources?: string[] };
type RoleData = { label: string; status: string; summary?: string; distinguishingFocus?: string; responsibilities: string[]; references?: string[]; competencies: Requirement[] };
type Framework = {
  frameworkVersion: string; status: string;
  provenance: { basis: string; reviewedBy: string | null; references: Reference[]; changes?: { version: string; at: string; summary: string }[] };
  domains: Record<string, { label: string; description: string }>;
  careerLevels: { basis: string; rule: string; status: string; note: string };
  openQuestions: { id: string; roles: string[]; question: string; status: string; note: string }[];
  competencies: Record<string, Competency>;
  roles: Record<string, RoleData>;
};

export const FRAMEWORK = data as unknown as Framework;
const CURRENT = (registry.roles as { id: string; status: string }[]).filter((r) => r.status === "current").map((r) => r.id);
const REFS = new Map(FRAMEWORK.provenance.references.map((r) => [r.id, r]));

export function roleSummaries() {
  return CURRENT.map((id) => {
    const r = FRAMEWORK.roles[id];
    const core = r.competencies.filter((c) => c.tier !== "specialisation");
    return {
      id, label: r.label,
      required: core.filter((c) => c.tier === "required").length,
      supporting: core.filter((c) => c.tier === "supporting").length,
      domains: new Set(core.map((c) => FRAMEWORK.competencies[c.competency]?.domain)).size,
      references: (r.references ?? []).length,
      unreachableReferences: (r.references ?? []).filter((x) => REFS.get(x)?.linkCheck?.result !== "reachable").length,
      openQuestions: FRAMEWORK.openQuestions.filter((q) => q.roles.includes(id)).length,
    };
  });
}

export function roleProfile(id: string) {
  const r = FRAMEWORK.roles[id];
  if (!r || !CURRENT.includes(id)) return null;
  const core = r.competencies.filter((c) => c.tier !== "specialisation");
  const byDomain = Object.entries(FRAMEWORK.domains)
    .map(([key, d]) => ({
      key, label: d.label,
      rows: core.filter((c) => FRAMEWORK.competencies[c.competency]?.domain === key).map((c) => ({ ...c, definition: FRAMEWORK.competencies[c.competency] })),
    }))
    .filter((d) => d.rows.length);
  return {
    id, label: r.label, summary: r.summary, distinguishingFocus: r.distinguishingFocus, responsibilities: r.responsibilities,
    byDomain,
    specialisations: r.competencies.filter((c) => c.tier === "specialisation"),
    references: (r.references ?? []).map((x) => REFS.get(x)).filter(Boolean) as Reference[],
    openQuestions: FRAMEWORK.openQuestions.filter((q) => q.roles.includes(id)),
  };
}

export const isCurrentRole = (id: string) => CURRENT.includes(id);
export const openQuestionIds = () => FRAMEWORK.openQuestions.map((q) => q.id);

/** True once migration 0035 is applied. Until then the page shows the frameworks and says reviews/quality need it. */
async function tablesReady(): Promise<boolean> {
  try {
    const { rows } = await db.execute(sql`select to_regclass('public.framework_reviews') is not null and to_regclass('public.intelligence_snapshots') is not null as ok`);
    return Boolean((rows[0] as { ok?: boolean })?.ok);
  } catch {
    return false;
  }
}

export async function reviewsFor(version: string) {
  if (!(await tablesReady())) return null;
  return db.select().from(frameworkReviews).where(eq(frameworkReviews.frameworkVersion, version)).orderBy(desc(frameworkReviews.createdAt)).limit(200);
}

export async function recordReview(input: { version: string; role: string | null; questionId: string | null; decision: FrameworkReviewDecision; note: string; reviewerId: string; reviewerEmail: string }) {
  if (!(await tablesReady())) return { ok: false as const, error: "Reviews need migration 0035 (framework_reviews), which isn't applied to this database yet." };
  await db.insert(frameworkReviews).values({
    frameworkVersion: input.version, role: input.role, questionId: input.questionId, decision: input.decision, note: input.note,
    reviewerId: input.reviewerId, reviewerEmail: input.reviewerEmail,
  });
  return { ok: true as const };
}

/**
 * Assessment quality by methodology version: how many assessments each engine/framework version produced, how many were
 * a methodology-only change, and the alignment states of students' latest assessment. Aggregates only; no student is named.
 */
export async function assessmentQuality() {
  if (!(await tablesReady())) return null;
  const [byVersion, latestStates] = await Promise.all([
    db
      .select({
        engine: intelligenceSnapshots.engineVersion, framework: intelligenceSnapshots.frameworkVersion, n: sql<number>`count(*)::int`,
        methodologyOnly: sql<number>`count(*) filter (where (${intelligenceSnapshots.changes}->>'methodologyChanged')::boolean and not coalesce((${intelligenceSnapshots.changes}->>'evidenceChanged')::boolean, false))::int`,
      })
      .from(intelligenceSnapshots)
      .groupBy(intelligenceSnapshots.engineVersion, intelligenceSnapshots.frameworkVersion)
      .orderBy(desc(intelligenceSnapshots.engineVersion)),
    db.execute(sql`
      select latest.summary->'roles'->0->>'role' as role, latest.summary->'roles'->0->>'state' as state, count(*)::int as n
      from (select distinct on (user_id) summary from intelligence_snapshots order by user_id, computed_at desc) latest
      where jsonb_array_length(latest.summary->'roles') > 0
      group by 1, 2 order by 1, 2`),
  ]);
  return { byVersion, latestStates: latestStates.rows as { role: string; state: string; n: number }[] };
}
