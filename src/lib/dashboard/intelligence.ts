// Shared view models over the engine's intelligence document (worker/intelligence/career_engine.py). Every dashboard card
// reads skills, gaps and levels through these helpers, so a skill can't read differently from one card to the next.
// Nothing here creates a score, a state or a skill: it selects and words what the engine wrote.

import type {
  EngineSkill,
  EvidenceBasis,
  GapCategory,
  GapInventoryRow,
  GapState,
  IntelligenceDoc,
  RoleAnalysis,
  RoleSkillRow,
} from "@/lib/dashboard/types";

export const LEVEL_STEPS = ["Foundational", "Working", "Proficient", "Advanced"] as const;

/** 0 when not assessed, 1-4 for Foundational..Advanced. */
export function levelStep(level: string | null | undefined): number {
  const i = LEVEL_STEPS.indexOf((level ?? "") as (typeof LEVEL_STEPS)[number]);
  return i + 1;
}

/** A role's open rows in the engine's priority order. Secondary goals are stored compact with `open` empty (engine v4). */
export function openRows(analysis: RoleAnalysis): RoleSkillRow[] {
  if (!analysis.compact) return analysis.open;
  return analysis.skills.filter((r) => r.state !== "met").sort((a, b) => (a.priorityRank ?? 999) - (b.priorityRank ?? 999) || a.skill.localeCompare(b.skill));
}

export function primaryAnalysis(intel: IntelligenceDoc | undefined, primaryRole?: string | null): RoleAnalysis | undefined {
  if (!intel) return undefined;
  return (primaryRole ? intel.roles.find((r) => r.role === primaryRole) : undefined) ?? intel.roles[0];
}

/** v3 states mapped to the v4 categories, for documents written before the engine produced categories. */
const STATE_CATEGORY: Record<GapState, GapCategory> = {
  met: "meets",
  underdeveloped: "needs_practice",
  unverified: "proof_needed",
  inferred: "possibly",
  missing: "not_shown",
  not_assessed: "not_assessed",
};

export function categoryOf(row: Pick<RoleSkillRow, "state" | "category">): GapCategory {
  return row.category ?? STATE_CATEGORY[row.state] ?? "not_assessed";
}

export type DevelopRow = (GapInventoryRow | RoleSkillRow) & { sources?: GapInventoryRow["sources"]; projectImportance?: GapInventoryRow["projectImportance"] };

/**
 * Everything still to develop, highest priority first: the engine's complete gap inventory (career framework, project and
 * prerequisites) when it wrote one, otherwise the primary goal's open rows (engine v3 documents).
 */
export function skillsToDevelop(intel: IntelligenceDoc | undefined, primaryRole?: string | null): DevelopRow[] {
  if (!intel) return [];
  if (intel.gapInventory?.length) return intel.gapInventory.filter((r) => categoryOf(r) !== "meets");
  const analysis = primaryAnalysis(intel, primaryRole);
  return analysis ? openRows(analysis).filter((r) => r.state !== "met") : [];
}

/** How the strongest evidence for a skill was obtained, in plain words. */
export const EVIDENCE_BASIS: Record<EvidenceBasis, { label: string; explain: string }> = {
  assessed: { label: "Assessed", explain: "A platform assessment or activity we read directly." },
  demonstrated: { label: "Shown in your code", explain: "The code of a repository that's yours uses it: language statistics, a dependency file, or tests, CI or a Dockerfile you added. That shows use, not how well." },
  detected: { label: "Found in a repository", explain: "It's in the code of a repository we can't attribute to you (a collaborator or organisation repository without commit counts showing the work is mostly yours)." },
  repository_mention: { label: "Named in a repository", explain: "A repository's topics, description or README name it, but its code doesn't show it in use." },
  described: { label: "Your own description", explain: "Your resume or profile describes using it. Nothing we can check shows it yet." },
  claimed: { label: "Listed only", explain: "Listed in your skills. A listing doesn't earn a level." },
  inferred: { label: "Suggested", explain: "Related skills suggest it. Nothing shows it yet." },
  not_found: { label: "No evidence yet", explain: "Nothing we've read shows this skill yet. That isn't the same as not knowing it." },
};

export function evidenceBasisOf(skill: Pick<EngineSkill, "evidenceBasis" | "evidenceState" | "status" | "proficiency">): EvidenceBasis {
  if (skill.evidenceBasis) return skill.evidenceBasis;
  if (skill.status === "inferred") return "inferred";
  if (skill.evidenceState === "demonstrated" || skill.status === "verified") return "demonstrated";
  if (skill.evidenceState === "unverified") return "described";
  return "claimed";
}

/** One short line of evidence for a tight row: the engine's first basis line, else a count of evidence items. */
export function basisLine(skill: Pick<EngineSkill, "levelBasis" | "evidenceCount">): string | null {
  if (skill.levelBasis?.length) return skill.levelBasis[0];
  return skill.evidenceCount ? `${skill.evidenceCount} piece${skill.evidenceCount === 1 ? "" : "s"} of evidence` : null;
}

export type Relevance = { label: string; tone: "required" | "supporting" | "project" | "specialisation" };

/** Whether a skill matters for the primary goal or the student's project, from the engine's rows. */
export function relevanceOf(intel: IntelligenceDoc | undefined, skill: string, primaryRole?: string | null): Relevance | null {
  if (!intel) return null;
  const inv = intel.gapInventory?.find((r) => r.skill === skill);
  const row = primaryAnalysis(intel, primaryRole)?.skills.find((r) => r.skill === skill);
  const tier = inv?.roleTier ?? row?.tier ?? null;
  if (tier === "required") return { label: "Required for your goal", tone: "required" };
  if (inv?.projectImportance === "core") return { label: "Needed by your project", tone: "project" };
  if (tier === "supporting") return { label: "Supports your goal", tone: "supporting" };
  if (inv?.projectImportance === "supporting") return { label: "Useful for your project", tone: "project" };
  return null;
}
