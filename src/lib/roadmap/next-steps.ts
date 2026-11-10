import { roleLabel } from "@/components/dashboard/widgets/labels";
import type { IntelligenceDoc } from "@/lib/dashboard/types";
import { roadmapProgress, type MilestoneSubmission } from "@/lib/roadmap/progress";

export type NextStep = { num: number; title: string; desc: string; btnText: string; btnHref: string; category?: string };
export type NextSteps = { steps: NextStep[]; empty: { message: string; href?: string; action?: string } | null };

const STATE_NOTE: Record<string, string> = {
  underdeveloped: "your evidence shows it below the expected level",
  unverified: "you've listed it, but no independent work shows it yet",
  inferred: "it's only suggested so far",
  missing: "nothing on your profile shows it yet",
  not_assessed: "there isn't enough evidence to assess it",
};

/**
 * Next steps come only from the engine's roadmap for the user's chosen goal and its gap analysis: the milestones
 * that can be worked on now (the active one first, then others whose prerequisites are met), never blocked or
 * completed ones, each with its course when the catalogue has one. With no goal, no framework or no evidence, it
 * says what's missing instead of inventing steps.
 */
export function nextStepsFromRoadmap(intelligence: IntelligenceDoc | undefined, submissions: MilestoneSubmission[] = [], max = 3, { excludeNext = false } = {}): NextSteps {
  if (!intelligence) return { steps: [], empty: { message: "Your next steps appear once your profile has been processed." } };
  const roadmap = intelligence.roadmap;
  if (!roadmap) {
    return intelligence.unsupportedRoles.length
      ? { steps: [], empty: { message: "Your career goal doesn't have a competency framework yet, so there are no next steps we can stand behind." } }
      : { steps: [], empty: { message: "Next steps come from a career goal you've chosen. Goals are chosen during onboarding; changing them afterwards isn't available yet." } };
  }
  const progress = roadmapProgress(roadmap, intelligence.computedAt, submissions);
  const goal = roleLabel(roadmap.role);
  const rows = new Map((intelligence.roles.find((r) => r.role === roadmap.role)?.skills ?? []).map((r) => [r.skill, r]));
  const recs = new Map(intelligence.recommendations.map((r) => [r.skill, r]));
  // excludeNext: the roadmap's own Next action already shows the engine's next milestone, so don't repeat it here.
  const workable = progress.steps.filter((s) => (s.status === "active" || s.status === "needs_more_evidence" || s.status === "upcoming") && !(excludeNext && s.id === progress.nextId));
  workable.sort((a, b) => Number(b.id === progress.nextId) - Number(a.id === progress.nextId));

  if (!workable.length) {
    const pending = progress.steps.some((s) => s.status === "submitted");
    return {
      steps: [],
      empty: progress.steps.length === 0
        ? { message: `Every skill ${goal} needs is at its expected level, based on your evidence.` }
        : pending
          ? { message: "Your submitted evidence is waiting for the next evaluation. Nothing else is open until then." }
          : { message: "Every open milestone is waiting on a prerequisite first. Open the roadmap to see which.", href: "#career-roadmap", action: "Open roadmap" },
    };
  }

  const steps = workable.slice(0, max).map((s, i): NextStep => {
    const row = rows.get(s.skill);
    const rec = recs.get(s.skill);
    const why = row && STATE_NOTE[row.state] ? `${goal} expects ${s.skill} at ${row.expectedLevel}; ${STATE_NOTE[row.state]}.` : `Part of the ${goal} framework.`;
    return {
      num: i + 1,
      title: s.status === "needs_more_evidence" ? `${s.skill}: add more evidence` : `${s.skill}: ${s.deliverable.charAt(0).toLowerCase()}${s.deliverable.slice(1)}`,
      desc: why,
      btnText: rec?.resource ? `Course: ${rec.resource.title}` : "Open in roadmap",
      btnHref: rec?.resource?.url ?? "#career-roadmap",
      category: s.stageKey,
    };
  });
  return { steps, empty: null };
}
