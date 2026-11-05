import type { EngineRoadmap, RoadmapMilestone } from "@/lib/dashboard/types";

/**
 * Milestone states for the Career Roadmap, combining the engine's evidence assessment with the
 * evidence the user has submitted. The rule that keeps this honest:
 *
 *   completed            only when the engine finds the skill at its expected level from evidence
 *   submitted            the user submitted evidence the engine hasn't processed yet (pending review)
 *   needs_more_evidence  the engine ran after the submission and the skill still isn't at level
 *   active               the next milestone to work on: prerequisites done, not yet completed
 *   upcoming             everything else
 *
 * A submission never completes a milestone and never moves the progress figure, which is the
 * engine's evidence coverage for the role and nothing else.
 */
export type MilestoneStatus = "completed" | "submitted" | "needs_more_evidence" | "active" | "upcoming";

export type MilestoneSubmission = { milestoneId: string; evidenceUrl: string; createdAt: Date | string };

export type RoadmapStep = {
  id: string;
  skill: string;
  stageKey: string;
  stageTitle: string;
  status: MilestoneStatus;
  deliverable: string;
  criterion: string;
  requires: string[];
  estimateWeeks: number;
  submissions: number;
};

export type RoadmapProgress = {
  role: string;
  /** 0-1: the engine's evidence coverage for the role. */
  progress: number;
  completed: string[];
  steps: RoadmapStep[];
  nextId: string | null;
};

export function milestoneId(role: string, skill: string): string {
  return `${role}:${skill.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

const idOf = (role: string, m: RoadmapMilestone) => m.id ?? milestoneId(role, m.skill);

export function roadmapProgress(roadmap: EngineRoadmap, computedAt: string | Date, submissions: MilestoneSubmission[] = []): RoadmapProgress {
  const computed = new Date(computedAt).getTime();
  const completed = new Set(roadmap.completed);
  const byId = new Map<string, MilestoneSubmission[]>();
  for (const s of submissions) byId.set(s.milestoneId, [...(byId.get(s.milestoneId) ?? []), s]);

  const steps: RoadmapStep[] = [];
  for (const stage of roadmap.stages) {
    for (const m of stage.milestones) {
      const id = idOf(roadmap.role, m);
      const subs = byId.get(id) ?? [];
      let status: MilestoneStatus = "upcoming";
      if (m.done || completed.has(m.skill)) status = "completed";
      else if (subs.length) {
        const newest = Math.max(...subs.map((s) => new Date(s.createdAt).getTime()));
        status = newest > computed ? "submitted" : "needs_more_evidence";
      }
      steps.push({
        id,
        skill: m.skill,
        stageKey: stage.key,
        stageTitle: stage.title,
        status,
        deliverable: m.deliverable,
        criterion: m.criterion,
        requires: m.requires,
        estimateWeeks: m.estimateWeeks,
        submissions: subs.length,
      });
    }
  }

  // The next milestone: the first open one whose prerequisites are all done.
  const done = (skill: string) => completed.has(skill) || steps.some((s) => s.skill === skill && s.status === "completed");
  const next = steps.find((s) => s.status !== "completed" && s.requires.every(done)) ?? steps.find((s) => s.status !== "completed") ?? null;
  if (next && next.status === "upcoming") next.status = "active";

  return { role: roadmap.role, progress: Math.max(0, Math.min(1, roadmap.progress)), completed: roadmap.completed, steps, nextId: next?.id ?? null };
}
