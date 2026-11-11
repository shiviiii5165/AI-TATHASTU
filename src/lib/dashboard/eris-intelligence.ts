// ERIS — Intelligence Score, and the "Where you stand" view model.
//
// The score is computed by the career engine (worker/intelligence/career_engine.py alignment_score) and stored on
// each role analysis as `alignmentScore`. This module only reads it; it computes no score. See that function for
// the definition: how much of the selected role's competency framework the student's evidence currently backs,
// 0-100, with half credit for self-described evidence where independent proof is required and no credit (never a
// level) for listed, suggested or missing competencies. Not a proficiency, not the alignment state, not a hiring
// or job-readiness probability.
//
// Why the old number isn't shown: worker/intelligence/eris.py computes interview readiness. It credits
// self-described skills fully, gives 25% for project technology lists that may be self-described, and rescales
// when LeetCode/HackerRank are missing, so it isn't comparable or defensible under engine v3. It stays in
// eris_scores for its existing readers.

import type { AlignmentState, IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";
import { gapNoteText } from "@/lib/dashboard/plain-language";

export const CURRENT_ENGINE = 3;

export type ScoreFactor = { label: string; score: number | null; competencies: number };

export type IntelligenceScore = {
  score: number;
  required: ScoreFactor;
  supporting: ScoreFactor;
  counts: { evidenced: number; described: number; none: number };
};

/**
 * The engine's score for this role, as stored. "pending": the document predates the engine writing it (it appears
 * after the next recalculation); "unavailable": the engine wrote null (not enough evidence). Never 0 for unknown.
 */
export function engineScore(analysis: RoleAnalysis | undefined | null): { status: "ready"; score: IntelligenceScore } | { status: "pending" | "unavailable" } {
  if (!analysis || analysis.alignmentScore === undefined) return { status: "pending" };
  const s = analysis.alignmentScore;
  if (s === null || typeof s.value !== "number" || !Number.isFinite(s.value)) return { status: "unavailable" };
  return {
    status: "ready",
    score: {
      score: s.value,
      required: { label: "Required skills", score: s.required?.score ?? null, competencies: s.required?.competencies ?? 0 },
      supporting: { label: "Supporting skills", score: s.supporting?.score ?? null, competencies: s.supporting?.competencies ?? 0 },
      counts: { evidenced: s.counts?.evidenced ?? 0, described: s.counts?.described ?? 0, none: s.counts?.none ?? 0 },
    },
  };
}

/** @deprecated kept for callers that only need the value; reads the engine's score. */
export function intelligenceScore(analysis: RoleAnalysis | undefined | null): IntelligenceScore | null {
  const s = engineScore(analysis);
  return s.status === "ready" ? s.score : null;
}

export type PriorityGap = { skill: string; note: string; why: string | null };

/**
 * What kind of gap it is, from the engine's state (the engine maps both "inferred" and described-only rows to the
 * gap type insufficient_evidence, so the state decides). "Missing" is said only when there is no evidence at all.
 */
export function gapNote(row: RoleSkillRow): string {
  return gapNoteText(row);
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
      /** Why there's no score: the engine hasn't recalculated since it started writing one, or there isn't enough evidence. */
      scoreStatus: "ready" | "pending" | "unavailable";
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
  const s = analysis.assessed ? engineScore(analysis) : ({ status: "unavailable" } as const);
  return {
    state: "ready",
    computedAt,
    role: analysis.role,
    draft: (analysis.framework?.status ?? intelligence.framework?.status ?? "").startsWith("draft") || analysis.framework?.reviewed === false,
    alignment: a ? { state: a.state, label: a.label, requiredMet: a.requiredMet, required: a.required } : null,
    assessed: analysis.assessed,
    score: s.status === "ready" ? s.score : null,
    scoreStatus: s.status,
    gaps: analysis.assessed ? priorityGaps(analysis) : [],
  };
}