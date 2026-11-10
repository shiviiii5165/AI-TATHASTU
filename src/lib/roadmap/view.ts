// Career Roadmap view model: everything the dashboard roadmap shows, derived only from the engine's intelligence
// document (worker/intelligence/career_engine.py) and the user's milestone submissions. No career, skill, count,
// percentage, milestone or estimate is made up here: when the engine hasn't produced something, the field is null
// and the UI says so.

import { roleLabel } from "@/components/dashboard/widgets/labels";
import type { GapState, IntelligenceDoc, LearningRecommendation, RoleSkillRow } from "@/lib/dashboard/types";
import { ALL_CAREER_ROLES } from "@/lib/onboarding/catalog";
import { milestoneReason } from "@/lib/roadmap/explain";
import { roadmapProgress, type MilestoneSubmission, type RoadmapStep } from "@/lib/roadmap/progress";

export const HORIZON_LABELS = ["Short term", "Mid term", "Long term"] as const;

export type StageStatus = "completed" | "active" | "upcoming" | "blocked";

export type RoadmapStageView = {
  key: string;
  /** The engine's own stage title ("Build the foundations"). */
  title: string;
  /** Short / mid / long term, by the engine's stage order. */
  horizon: string;
  status: StageStatus;
  steps: RoadmapStep[];
  /** Prerequisite skills holding the whole stage back, when every open milestone in it is blocked. */
  blockedBy: string[];
  /** The engine's planning estimate, in weeks, stated with `assumption`; null when it gave none. */
  estimateWeeks: number | null;
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
      coverage: { met: number; total: number; percent: number | null; assessed: boolean };
      stages: RoadmapStageView[];
      nextStage: RoadmapStageView | null;
      nextAction: { step: RoadmapStep; reason: string; row: RoleSkillRow | null; rec: LearningRecommendation | null; horizon: string } | null;
      skills: SkillBucket[];
      steps: RoadmapStep[];
      assumption: string;
    };

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
      horizon: HORIZON_LABELS[Math.min(i, HORIZON_LABELS.length - 1)],
      status,
      steps,
      blockedBy: allBlocked ? [...new Set(open.flatMap((s) => s.blockedBy))] : [],
      estimateWeeks: Number.isFinite(stage.estimateWeeks) && stage.estimateWeeks > 0 ? stage.estimateWeeks : null,
    };
  });

  const next = progress.steps.find((s) => s.id === progress.nextId) ?? null;
  const nextStage = stages.find((s) => s.status === "active") ?? null;
  const total = rows.length || progress.completed.length + progress.steps.length;
  const assessed = Boolean(analysis?.assessed);

  return {
    state: "ready",
    computedAt: intelligence.computedAt,
    goal: { id: roadmap.role, label: roleLabel(roadmap.role), blurb: ALL_CAREER_ROLES.find((r) => r.id === roadmap.role)?.blurb ?? null },
    position: roadmap.currentPosition,
    coverage: { met: progress.completed.length, total, percent: assessed ? Math.round(progress.progress * 100) : null, assessed },
    stages,
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
    assumption: roadmap.assumption,
  };
}
