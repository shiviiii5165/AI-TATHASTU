// One student-facing vocabulary for the engine's skill states, levels and prerequisites, used by every dashboard
// card (Skill Gaps, Career Roadmap, Skills to develop, Where you stand) so a skill reads the same everywhere.
// Wording only: the states themselves come from the engine (career_engine.analyze_role). Missing evidence is never
// described as missing ability.

import type { GapCategory, GapState, RoleSkillRow } from "@/lib/dashboard/types";

export type Tone = "green" | "blue" | "orange" | "grey";

/** Short label for a chip, and one plain sentence explaining it. */
export type StateText = { label: string; sentence: string; tone: Tone };

const TEXT: Record<GapState | "described", StateText> = {
  met: { label: "Meets expected level", sentence: "Your work currently meets this role's expected level.", tone: "green" },
  underdeveloped: { label: "More practice needed", sentence: "You've shown some experience, but more practice is needed for this role.", tone: "blue" },
  unverified: { label: "Listed, not yet shown", sentence: "You've listed this skill, but we haven't found a work example that demonstrates it yet.", tone: "orange" },
  described: { label: "Described, not yet checkable", sentence: "Your own project or work descriptions mention it, but we haven't found work we can check, such as a public repository.", tone: "orange" },
  inferred: { label: "Possibly relevant", sentence: "This skill may be relevant based on your work, but it hasn't been confirmed.", tone: "grey" },
  missing: { label: "No work examples yet", sentence: "We haven't found examples of your work in this skill yet.", tone: "orange" },
  not_assessed: { label: "Not assessed yet", sentence: "We don't have enough information to assess this skill yet.", tone: "grey" },
};

/** Engine v4 categories (career_engine.CATEGORY), one wording for every card. */
const CATEGORY_TEXT: Record<GapCategory, StateText> = {
  meets: TEXT.met,
  needs_practice: TEXT.underdeveloped,
  proof_needed: { label: "Practical proof needed", sentence: "Your profile mentions this skill, but we haven't found work we can check that shows it, such as a public repository.", tone: "orange" },
  foundation: { label: "Foundation to build first", sentence: "Other skills for your goal build on this one, and we haven't seen it in your work yet, so it's a good place to start.", tone: "orange" },
  not_shown: { label: "Not shown yet", sentence: "We haven't found this skill in the work we can see. That isn't the same as not knowing it.", tone: "orange" },
  possibly: TEXT.inferred,
  not_assessed: TEXT.not_assessed,
};

/** The engine's state in plain words: its v4 category when present, else the v3 state. */
export function stateText(row: Pick<RoleSkillRow, "state" | "proficiency" | "category">): StateText {
  if (row.category && CATEGORY_TEXT[row.category]) return CATEGORY_TEXT[row.category];
  const scored = row.proficiency !== null && row.proficiency !== undefined;
  if (row.state === "unverified" && scored) return TEXT.described;
  return TEXT[row.state] ?? TEXT.not_assessed;
}

export const gapNoteText = (row: Pick<RoleSkillRow, "state" | "proficiency" | "category">) => stateText(row).label;

/** What each of the four levels asks for, in a phrase that completes "expects you to …". */
const LEVEL_EXPECTS: Record<string, string> = {
  Foundational: "understand the basics",
  Working: "do practical tasks with some guidance",
  Proficient: "use this skill independently",
  Advanced: "design and optimise complex work",
};

/** "ML Engineer expects you to use this skill independently (Proficient)." Falls back to the level name. */
export function expectsText(goal: string, level: string): string {
  const what = LEVEL_EXPECTS[level];
  return what ? `${goal} expects you to ${what} (${level}).` : `${goal} expects ${level} level.`;
}

/** Short form for tight rows: "needs: use it independently". */
export function needsShort(level: string): string {
  const what = LEVEL_EXPECTS[level];
  return what ? `Needed: ${what.replace("this skill", "it")}` : `Needed: ${level}`;
}

/** The engine's assessed level in words, or that it couldn't assess one. */
export function currentLevelText(row: Pick<RoleSkillRow, "proficiency" | "level">): string {
  return row.proficiency === null || row.proficiency === undefined ? "Not assessed yet" : `Assessed at ${row.level}`;
}

/** Replaces "Complete X first to unlock this step" with the actual prerequisite. */
export function prerequisiteText(skills: string[]): string {
  const list = skills.length <= 1 ? (skills[0] ?? "") : `${skills.slice(0, -1).join(", ")} and ${skills.at(-1)}`;
  return `Start this after your work shows ${list} at the level this role expects, because it builds on ${skills.length === 1 ? "it" : "them"}.`;
}

export const TONE_CLASS: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30",
  blue: "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30",
  orange: "bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-400/30",
  grey: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-400/30",
};
