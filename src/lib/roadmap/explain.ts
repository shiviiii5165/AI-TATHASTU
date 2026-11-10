import type { GapState, RoleSkillRow } from "@/lib/dashboard/types";
import type { RoadmapStep } from "@/lib/roadmap/progress";

const GAP_TEXT: Record<GapState, string> = {
  met: "your evidence shows it at that level",
  underdeveloped: "your evidence shows it, but below that level",
  unverified: "you have listed it, but we need more proof of your ability",
  inferred: "it's only suggested by your other skills so far",
  missing: "nothing on your profile shows it yet",
  not_assessed: "there isn't enough evidence to assess it",
};

/** Why a milestone is on the roadmap, from the role framework and the user's evidence. */
export function milestoneReason(roleName: string, row: RoleSkillRow | undefined, step: Pick<RoadmapStep, "skill" | "status">): string {
  if (step.status === "completed") return `${roleName} expects ${step.skill}${row ? ` at ${row.expectedLevel}` : ""}, and your evidence shows it at that level.`;
  if (!row) return `${step.skill} is part of the ${roleName} framework.`;
  return `${roleName} expects ${step.skill} at ${row.expectedLevel} (${row.priority.toLowerCase()} priority). Right now ${GAP_TEXT[row.state]}${row.proficiency !== null && row.state !== "met" ? ` (${row.level})` : ""}.`;
}
