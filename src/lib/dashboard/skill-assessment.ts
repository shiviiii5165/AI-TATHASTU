// Display model for the Skills page cards. Reads the engine's per-skill output (worker/intelligence/career_engine.py)
// and only renames it for students: no score, confidence, level, status or evidence is created or strengthened here.

import { confidenceLabel, evidenceKind } from "@/lib/dashboard/skill-intel";
import type { EngineSkill, EvidenceState } from "@/lib/dashboard/types";

export const LEVELS = [
  { level: "Foundational", meaning: "Understands basic concepts but has limited practical application." },
  { level: "Working", meaning: "Can complete practical tasks with guidance." },
  { level: "Proficient", meaning: "Can independently implement, evaluate and troubleshoot practical work." },
  { level: "Advanced", meaning: "Can design and optimise complex systems and explain technical decisions." },
] as const;

const KNOWN_LEVELS = new Set<string>(LEVELS.map((l) => l.level));

export type ShownState = Exclude<EvidenceState, "missing"> | "none";

export const EVIDENCE_STATE: Record<ShownState, { label: string; explain: string }> = {
  demonstrated: { label: "Demonstrated", explain: "Shown by a source we read directly, such as a GitHub repository, an assessment or platform activity." },
  unverified: { label: "Unverified", explain: "Rests on your own descriptions of projects or work. No independent source shows it yet." },
  claimed: { label: "Claimed", explain: "Listed in your skills. Nothing shows it being used yet." },
  inferred: { label: "Suggested", explain: "Related skills point to it. Nothing shows it, so it is not assessed." },
  none: { label: "No evidence", explain: "No evidence is recorded for this skill." },
};

/**
 * The engine's evidence state. Documents written before engine v3 have none, so the older status is mapped to the
 * same or a weaker state, never a stronger one.
 */
export function evidenceStateOf(skill: Pick<EngineSkill, "status" | "evidenceState">): ShownState {
  if (skill.evidenceState) return skill.evidenceState === "missing" ? "none" : skill.evidenceState;
  return skill.status === "verified" ? "demonstrated" : skill.status === "inferred" ? "inferred" : "claimed";
}

/** "Not assessed" whenever the engine gave no score; a mention alone is never Foundational. */
export function assessedLevel(skill: Pick<EngineSkill, "proficiency" | "level">): string {
  if (skill.proficiency === null || skill.proficiency === undefined) return "Not assessed";
  return KNOWN_LEVELS.has(skill.level) ? skill.level : skill.level || "Not assessed";
}

export type SkillGroups = { assessed: EngineSkill[]; claimed: EngineSkill[]; suggested: EngineSkill[] };

/** Every skill lands in exactly one group. Suggestions never count as assessed, even if a score were present. */
export function groupSkills(skills: EngineSkill[], inferred: EngineSkill[]): SkillGroups {
  const suggested = [...inferred, ...skills.filter((s) => s.status === "inferred" || s.evidenceState === "inferred")];
  const own = skills.filter((s) => !suggested.includes(s));
  const assessed = own
    .filter((s) => s.proficiency !== null && s.proficiency !== undefined)
    .sort((a, b) => b.proficiency! - a.proficiency! || b.confidence - a.confidence || a.name.localeCompare(b.name));
  const claimed = own.filter((s) => s.proficiency === null || s.proficiency === undefined).sort((a, b) => b.evidenceCount - a.evidenceCount || a.name.localeCompare(b.name));
  return { assessed, claimed, suggested };
}

/** Recorded evidence by kind, with real counts. "claim" is the student's own skills list. */
export function evidenceSources(skill: Pick<EngineSkill, "evidence">): { kind: string; label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of skill.evidence) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, label: kind === "claim" ? "Self-reported" : evidenceKind(kind).label, count })).sort((a, b) => Number(a.kind === "claim") - Number(b.kind === "claim") || b.count - a.count);
}

/** Confidence wording; null when there is no assessment for it to describe. */
export function confidenceOf(skill: Pick<EngineSkill, "proficiency" | "confidence">): string | null {
  if (skill.proficiency === null || skill.proficiency === undefined || typeof skill.confidence !== "number") return null;
  return confidenceLabel(skill.confidence);
}
