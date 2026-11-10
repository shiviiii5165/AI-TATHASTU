// ERIS — Intelligence Score, and the "Where you stand" view model.
//
// Read-only over the career engine v3 output already stored in profile_views.view.intelligence
// (worker/intelligence/career_engine.py analyze_role). It adds no skill, level, evidence or relationship.
//
// Why not the worker's eris.py number: that score was built for interview readiness. Its technical part credits a
// skill's proficiency even when the role framework needs independent evidence and only the student's own
// descriptions back it, and 25% comes from projects whose technology lists may be self-described (three such
// projects give full marks with no demonstrated work). It also renormalises when LeetCode/HackerRank are absent,
// so two students' numbers aren't comparable. It stays in eris_scores for its existing readers; the dashboard no
// longer shows it.
//
// Definition (0–100, for the student's selected career direction):
//   For each competency in the role framework (deduplicated by name, keeping the best row), with weight w:
//     attainment a = min(1, proficiency / expected)                     when the engine scored it
//     credit       = a                                                  when the evidence meets the framework's
//                                                                        requirement (independent → demonstrated)
//                  = a / 2                                              when only the student's own descriptions
//                                                                        back a competency that needs independent proof
//                  = 0                                                  when the engine has no score (listed only,
//                                                                        suggested or missing): no evidence, so no credit
//   score = round(100 · Σ w·credit / Σ w)
//
// It measures how much of the selected role's framework the student's evidence currently backs. It is not a
// proficiency (the four levels stay per skill), not role alignment (a separate rule-based state), and not a
// hiring or job-readiness probability.
//
// No score (null) when: there's no engine output, it predates engine v3, no direction is selected or it has no
// framework, the engine couldn't assess the role, the alignment is "not enough evidence", or no competency has an
// engine score at all. Unknown never becomes 0.

import type { AlignmentState, IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";

export const CURRENT_ENGINE = 3;
/** Share of credit kept when only the student's descriptions back a competency that needs independent proof. */
export const DESCRIBED_ONLY_FACTOR = 0.5;

export type CreditKind = "evidenced" | "described" | "none";

export type ScoreFactor = { label: string; score: number | null; competencies: number };

export type IntelligenceScore = {
  score: number;
  required: ScoreFactor;
  supporting: ScoreFactor;
  counts: Record<CreditKind, number>;
};

const attainment = (row: RoleSkillRow) => (row.proficiency === null || row.proficiency === undefined || !(row.expected > 0) ? 0 : Math.min(1, Math.max(0, row.proficiency) / row.expected));

/** How a competency's evidence counts. Uses only the engine's own fields. */
export function creditKind(row: RoleSkillRow): CreditKind {
  if (row.proficiency === null || row.proficiency === undefined) return "none";
  const needsIndependent = row.evidenceRequirement === "independent";
  if (row.state === "met" || !needsIndependent || row.evidenceState === "demonstrated") return "evidenced";
  return "described";
}

export function credit(row: RoleSkillRow): number {
  const kind = creditKind(row);
  return kind === "none" ? 0 : kind === "described" ? attainment(row) * DESCRIBED_ONLY_FACTOR : attainment(row);
}

/** One row per competency: a duplicated row can't count twice. */
function unique(rows: RoleSkillRow[]): RoleSkillRow[] {
  const best = new Map<string, RoleSkillRow>();
  for (const r of rows) {
    const key = r.skill.trim().toLowerCase();
    const prev = best.get(key);
    if (!prev || credit(r) > credit(prev)) best.set(key, r);
  }
  return [...best.values()];
}

function weighted(rows: RoleSkillRow[]): number | null {
  const valid = rows.filter((r) => r.weight > 0);
  const total = valid.reduce((s, r) => s + r.weight, 0);
  if (!total) return null;
  return Math.round((100 * valid.reduce((s, r) => s + r.weight * credit(r), 0)) / total);
}

export function intelligenceScore(analysis: RoleAnalysis | undefined | null): IntelligenceScore | null {
  if (!analysis || !analysis.assessed || analysis.alignment?.state === "not_enough_evidence") return null;
  const rows = unique(analysis.skills);
  if (!rows.some((r) => creditKind(r) !== "none")) return null;
  const score = weighted(rows);
  if (score === null) return null;
  const required = rows.filter((r) => (r.tier ?? "required") === "required");
  const supporting = rows.filter((r) => r.tier === "supporting");
  const counts: Record<CreditKind, number> = { evidenced: 0, described: 0, none: 0 };
  for (const r of rows) counts[creditKind(r)]++;
  return {
    score,
    required: { label: "Required competencies", score: weighted(required), competencies: required.length },
    supporting: { label: "Supporting competencies", score: weighted(supporting), competencies: supporting.length },
    counts,
  };
}

export type PriorityGap = { skill: string; note: string; why: string | null };

/**
 * What kind of gap it is, from the engine's state (the engine maps both "inferred" and described-only rows to the
 * gap type insufficient_evidence, so the state decides). "Missing" is said only when there is no evidence at all.
 */
export function gapNote(row: RoleSkillRow): string {
  const scored = row.proficiency !== null && row.proficiency !== undefined;
  switch (row.state) {
    case "missing":
      return "No evidence yet";
    case "inferred":
      return "Only suggested by related skills";
    case "unverified":
      return scored ? "Shown only in your own descriptions" : "Listed, not yet shown in your work";
    case "underdeveloped":
      return "Shown, below the expected level";
    case "met":
      return "At the expected level";
    default:
      return "Not assessed";
  }
}

export type StandingView =
  | { state: "pending" }
  | { state: "legacy"; computedAt: string }
  | { state: "no_direction"; computedAt: string }
  | { state: "unsupported"; computedAt: string; roles: string[] }
  | {
      state: "ready";
      computedAt: string;
      role: string;
      draft: boolean;
      alignment: { state: AlignmentState; label: string; requiredMet: number; required: number } | null;
      assessed: boolean;
      score: IntelligenceScore | null;
      gaps: PriorityGap[];
    };

/**
 * Up to three required competencies holding the alignment back: the engine's critical gaps (required, no score)
 * in its priority order, then other open required rows. Supporting skills never appear here.
 */
export function priorityGaps(analysis: RoleAnalysis, max = 3): PriorityGap[] {
  const open = analysis.open.filter((r) => (r.tier ?? "required") === "required" && r.state !== "met");
  const critical = analysis.alignment?.criticalGaps ?? [];
  const ordered = [...critical.map((s) => open.find((r) => r.skill === s)).filter((r): r is RoleSkillRow => Boolean(r)), ...open.filter((r) => !critical.includes(r.skill))];
  return ordered.slice(0, max).map((r) => ({ skill: r.skill, note: gapNote(r), why: r.whyItMatters ?? null }));
}

export function standingView(intelligence: IntelligenceDoc | undefined, primaryRole: string | null): StandingView {
  if (!intelligence) return { state: "pending" };
  const computedAt = intelligence.computedAt;
  if ((intelligence.engineVersion ?? 0) < CURRENT_ENGINE) return { state: "legacy", computedAt };
  if (!primaryRole) return { state: "no_direction", computedAt };
  const analysis = intelligence.roles.find((r) => r.role === primaryRole);
  if (!analysis) return { state: "unsupported", computedAt, roles: intelligence.unsupportedRoles };
  const a = analysis.alignment;
  return {
    state: "ready",
    computedAt,
    role: analysis.role,
    draft: (analysis.framework?.status ?? intelligence.framework?.status ?? "").startsWith("draft") || analysis.framework?.reviewed === false,
    alignment: a ? { state: a.state, label: a.label, requiredMet: a.requiredMet, required: a.required } : null,
    assessed: analysis.assessed,
    score: intelligenceScore(analysis),
    gaps: analysis.assessed ? priorityGaps(analysis) : [],
  };
}
