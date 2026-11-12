// Client-safe helpers for "What do you want to build?". The analysis itself is the engine's
// (worker/intelligence/project_intent.py, MAX_CHARS = 1200); this only normalises input and words the result.

import type { ProjectAnalysis } from "@/lib/dashboard/types";

export const PROJECT_INTENT_MAX = 1200;

export function cleanProjectIntent(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export type IntentSummary =
  | { state: "none" }
  | { state: "pending"; text: string }
  | { state: "too_vague"; text: string; reason: string; prompts: string[]; questions: string[]; possible: string[] }
  | { state: "analysed"; text: string; core: string[]; supporting: string[]; projectOnly: string[]; careerOnly: string[]; ready: number; closest: string[]; fromOnboarding: boolean; questions: string[]; possible: string[] };

/**
 * What the card shows. `saved` is the text the student just saved; until the engine has read it (its stored text differs),
 * the result is "pending" rather than an analysis of different words.
 */
export function intentSummary(project: ProjectAnalysis | undefined, saved?: string | null): IntentSummary {
  const savedText = saved === undefined ? undefined : cleanProjectIntent(saved ?? "");
  if (savedText !== undefined && savedText !== (project?.source === "profile" ? project.text ?? "" : "")) {
    return savedText ? { state: "pending", text: savedText } : { state: "none" };
  }
  if (!project || project.status === "none" || !project.text) return { state: "none" };
  const questions = project.questions ?? [];
  const possible = (project.possible ?? []).map((p) => p.skill);
  if (project.status === "too_vague") return { state: "too_vague", text: project.text, reason: project.reason ?? "", prompts: project.prompts, questions, possible };
  const rows = project.rows ?? [];
  return {
    state: "analysed",
    text: project.text,
    core: rows.filter((r) => r.importance === "core").map((r) => r.skill),
    supporting: rows.filter((r) => r.importance === "supporting").map((r) => r.skill),
    projectOnly: project.projectOnly ?? [],
    careerOnly: project.careerOnly ?? [],
    ready: project.summary?.coreReady ?? 0,
    closest: (project.closestRoles ?? []).map((r) => r.label),
    fromOnboarding: project.source === "onboarding_other",
    questions,
    possible,
  };
}
