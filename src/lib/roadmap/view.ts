// Career Roadmap view model: everything the dashboard roadmap shows, derived only from the engine's intelligence
// document (worker/intelligence/career_engine.py) and the user's milestone submissions. No career, skill, count,
// percentage, milestone or estimate is made up here: when the engine hasn't produced something, the field is null
// and the UI says so.

import { roleLabel } from "@/components/dashboard/widgets/labels";
import type { AlignmentState, EngineRoadmap, GapState, IntelligenceDoc, LearningRecommendation, RoadmapAchievement, RoleSkillRow } from "@/lib/dashboard/types";
import { ALL_CAREER_ROLES } from "@/lib/onboarding/catalog";
import { milestoneReason } from "@/lib/roadmap/explain";
import { roadmapProgress, type MilestoneSubmission, type RoadmapStep } from "@/lib/roadmap/progress";

/**
 * The engine's stages are groups ordered by prerequisites (the first holds every open skill with no open
 * prerequisite), not time horizons, so they're labelled by order, never "short / mid / long term".
 */
export const stageLabel = (index: number) => `Stage ${index + 1}`;

export type StageStatus = "completed" | "active" | "upcoming" | "blocked";

export type RoadmapStageView = {
  key: string;
  /** The engine's own stage title ("Build the foundations"). */
  title: string;
  /** "Stage 1", "Stage 2"… in the engine's order. */
  horizon: string;
  status: StageStatus;
  steps: RoadmapStep[];
  /** Prerequisite skills holding the whole stage back, when every open milestone in it is blocked. */
  blockedBy: string[];
  /** Optional stage: supporting skills only, never a condition for the goal. */
  optional: boolean;
  /** Older documents' planning estimate in weeks; engine v3 gives none and the UI shows none. */
  estimateWeeks: number | null;
  /** Engine v4: why the stage exists, what it covers, when it's complete and what comes next. Null on older documents. */
  purpose: string | null;
  focus: string | null;
  completionCriteria: string | null;
  unlocksTitle: string | null;
  projectSkills: number;
};

export type SkillBucket = { key: "demonstrated" | "inProgress" | "notYet"; label: string; note: string; rows: RoleSkillRow[] };

export type RoadmapView =
  | { state: "pending" }
  | { state: "no_goal" }
  | { state: "unsupported"; goals: string[] }
  | {
      state: "ready";
      computedAt: string;
      goal: { id: string; label: string; blurb: string | null };
      position: string | null;
      /** Counts only, never a percentage: how many of the goal's competencies the engine found at level. */
      coverage: { met: number; total: number; assessed: boolean };
      /** The engine's rule-based alignment state, in plain words; null on documents from before engine v3. */
      alignment: { state: AlignmentState; label: string; explanation: string; requiredMet: number; required: number; criticalGaps: string[] } | null;
      /** The role framework is a draft our team wrote, not an industry standard; the UI says so. */
      frameworkDraft: boolean;
      /** Every required competency is demonstrated: what's left is optional. */
      requirementsMet: boolean;
      stages: RoadmapStageView[];
      /**
       * Where the progress marker stands, as a node index on the journey (0 = where you are, 1.. = stages,
       * stages.length + 1 = the goal): after the last stage completed in an unbroken run from the start. It never
       * passes a stage the engine hasn't completed.
       */
      reachedIndex: number;
      nextStage: RoadmapStageView | null;
      nextAction: { step: RoadmapStep; reason: string; row: RoleSkillRow | null; rec: LearningRecommendation | null; horizon: string } | null;
      skills: SkillBucket[];
      steps: RoadmapStep[];
      assumption: string;
      /** Engine v4: competencies met from evidence, each with the evidence that met it. Empty on older documents. */
      achievements: RoadmapAchievement[];
      project: EngineRoadmap["project"] | null;
    };

/** Student-facing wording for each alignment state (career_engine.ALIGNMENT_RULES decides the state). */
export const ALIGNMENT_TEXT: Record<AlignmentState, string> = {
  not_enough_evidence: "We don't have enough of your work yet to see where you stand. Add your resume or connect GitHub.",
  early: "You're at the start: we haven't yet seen practical proof of this goal's required skills.",
  developing: "Some of the required skills are showing in your work. Keep building on them.",
  strong: "Most required skills, including the foundations, are showing in your work.",
  requirements_demonstrated: "Your available evidence now covers the required skills for your selected career path.",
};

const ROADMAP_BASIS_FALLBACK = "Ordered by what each skill builds on and how central it is to your goal. No time estimates: they'd depend on hours we don't know you have.";

const IN_PROGRESS: GapState[] = ["underdeveloped"];
const NOT_YET: GapState[] = ["unverified", "inferred", "missing", "not_assessed"];

export function roadmapView(intelligence: IntelligenceDoc | undefined, submissions: MilestoneSubmission[] = []): RoadmapView {
  if (!intelligence) return { state: "pending" };
  const roadmap = intelligence.roadmap;
  if (!roadmap) return intelligence.unsupportedRoles.length ? { state: "unsupported", goals: intelligence.unsupportedRoles.map(roleLabel) } : { state: "no_goal" };

  const progress = roadmapProgress(roadmap, intelligence.computedAt, submissions);
  const analysis = intelligence.roles.find((r) => r.role === roadmap.role) ?? null;
  const rows = analysis?.skills ?? [];
  const recs = new Map(intelligence.recommendations.map((r) => [r.skill, r]));
  const rowOf = (skill: string) => rows.find((r) => r.skill === skill) ?? null;

  const stages: RoadmapStageView[] = roadmap.stages.map((stage, i) => {
    const steps = progress.steps.filter((s) => s.stageKey === stage.key);
    const open = steps.filter((s) => s.status !== "completed");
    const allBlocked = open.length > 0 && open.every((s) => s.status === "blocked");
    const status: StageStatus = open.length === 0 ? "completed" : steps.some((s) => s.id === progress.nextId) ? "active" : allBlocked ? "blocked" : "upcoming";
    return {
      key: stage.key,
      title: stage.title,
      horizon: stageLabel(i),
      status,
      steps,
      blockedBy: allBlocked ? [...new Set(open.flatMap((s) => s.blockedBy))] : [],
      optional: Boolean(stage.optional),
      estimateWeeks: typeof stage.estimateWeeks === "number" && stage.estimateWeeks > 0 ? stage.estimateWeeks : null,
      purpose: stage.purpose ?? null,
      focus: stage.focus ?? null,
      completionCriteria: stage.completionCriteria ?? null,
      unlocksTitle: stage.unlocksTitle ?? null,
      projectSkills: stage.projectSkills ?? 0,
    };
  });

  const next = progress.steps.find((s) => s.id === progress.nextId) ?? null;
  const nextStage = stages.find((s) => s.status === "active") ?? null;
  const total = rows.length || progress.completed.length + progress.steps.length;
  const assessed = Boolean(analysis?.assessed);
  const a = analysis?.alignment ?? null;

  return {
    state: "ready",
    computedAt: intelligence.computedAt,
    goal: { id: roadmap.role, label: roleLabel(roadmap.role), blurb: ALL_CAREER_ROLES.find((r) => r.id === roadmap.role)?.blurb ?? null },
    position: roadmap.currentPosition,
    coverage: { met: progress.completed.length, total, assessed },
    alignment: a ? { state: a.state, label: a.label, explanation: ALIGNMENT_TEXT[a.state], requiredMet: a.requiredMet, required: a.required, criticalGaps: a.criticalGaps } : null,
    frameworkDraft: (analysis?.framework?.status ?? intelligence.framework?.status ?? "").startsWith("draft"),
    requirementsMet: Boolean(roadmap.requirementsMet),
    stages,
    reachedIndex: (() => {
      const lead = stages.findIndex((s) => s.status !== "completed");
      return lead === -1 ? stages.length + 1 : lead;
    })(),
    nextStage,
    nextAction: next
      ? { step: next, reason: milestoneReason(roleLabel(roadmap.role), rowOf(next.skill) ?? undefined, next), row: rowOf(next.skill), rec: recs.get(next.skill) ?? null, horizon: stages.find((s) => s.key === next.stageKey)?.horizon ?? "" }
      : null,
    skills: [
      { key: "demonstrated", label: "Demonstrated", note: "with evidence at the expected level", rows: rows.filter((r) => r.state === "met") },
      { key: "inProgress", label: "In progress", note: "evidence shows it, below the expected level", rows: rows.filter((r) => IN_PROGRESS.includes(r.state)) },
      { key: "notYet", label: "Not yet demonstrated", note: "listed only, suggested, or no evidence yet", rows: rows.filter((r) => NOT_YET.includes(r.state)) },
    ],
    steps: progress.steps,
    // Documents from before engine v3 state an hours-a-week assumption for estimates the UI no longer shows.
    assumption: intelligence.engineVersion >= 3 ? roadmap.assumption : ROADMAP_BASIS_FALLBACK,
    achievements: roadmap.achievements ?? [],
    project: roadmap.project ?? null,
  };
}
