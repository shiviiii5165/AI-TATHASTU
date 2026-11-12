/**
 * Explainable fit between a student and an opportunity, built only on the Intelligence Engine's
 * existing outputs (no second engine, no score, no percentage):
 *
 *   demonstrated  skills the engine assessed at Proficient/Advanced from evidence, or verified skills
 *   listed        skills on the profile without that evidence (claimed, still counted, labelled as such)
 *   level         study level from the student's degree, used only for an explicit published restriction
 *
 * Mandatory eligibility is evaluated separately from skill alignment, and only against a structured
 * restriction the listing actually published (eligibleLevels). Free-text eligibility is shown for the
 * student to check; it is never turned into a decision. A missing skill on the profile is "not shown
 * on your profile", never "you lack it". This informs the student; it never decides for an employer
 * or institution.
 */
export type FitState = "strong_fit" | "potential_fit" | "not_eligible" | "insufficient_information";
export type StudyLevel = "secondary" | "undergraduate" | "postgraduate" | "doctoral";

export interface StudentSignals {
  demonstrated: Map<string, string>; // lower-case name -> display name
  listed: Map<string, string>;
  level: StudyLevel | null;
}

export interface FitExplanation {
  state: FitState;
  /** One plain sentence: why this is (or is not) recommended. */
  summary: string;
  supportedBy: { skill: string; evidence: "demonstrated" | "listed" | "topic" }[];
  /** Required skills not shown on the profile (unverified, not "lacking"). */
  notShown: string[];
  eligibility: { status: "met" | "not_met" | "not_stated" | "unknown"; detail: string };
}

const LEVEL_PATTERNS: [StudyLevel, RegExp][] = [
  ["doctoral", /\b(ph\.?\s?d|doctor(ate|al)|d\.?phil)\b/i],
  ["postgraduate", /\b(m\.?\s?tech|m\.?\s?e\b|m\.?\s?sc|m\.?\s?s\b|msc|mba|m\.?\s?a\b|master'?s?|post\s?grad|pg\b|m\.?\s?phil)/i],
  ["undergraduate", /\b(b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|bsc|b\.?\s?s\b|b\.?\s?a\b|bca|bba|bachelor'?s?|under\s?grad|ug\b|b\.?\s?com)/i],
  ["secondary", /\b(class\s?(xi|xii|11|12)|higher secondary|hsc|high school|12th)\b/i],
];

/** Study level from a degree string; null when it cannot be told. Never guessed from age or year. */
export function studyLevel(degree: string | null | undefined): StudyLevel | null {
  if (!degree) return null;
  for (const [level, re] of LEVEL_PATTERNS) if (re.test(degree)) return level;
  return null;
}

const norm = (s: string) => s.trim().toLowerCase();

export function explainFit(
  opp: { requiredSkills: string[]; eligibleLevels: string[]; eligibility: string | null; /** The project's own topic / qualifications text, for relevance when no skills are published. */ topicText?: string | null },
  student: StudentSignals,
): FitExplanation {
  // 1. Mandatory eligibility, separately, from a published structured restriction only.
  let eligibility: FitExplanation["eligibility"];
  const levels = opp.eligibleLevels.map(norm).filter(Boolean);
  if (levels.length === 0) {
    eligibility = opp.eligibility
      ? { status: "unknown", detail: "Check the published eligibility on the source page." }
      : { status: "not_stated", detail: "The listing does not state eligibility conditions." };
  } else if (!student.level) {
    eligibility = { status: "unknown", detail: `Open to ${levels.join(", ")} students; add your degree so this can be checked.` };
  } else if (levels.includes(student.level)) {
    eligibility = { status: "met", detail: `Open to ${student.level} students, which matches your degree.` };
  } else {
    eligibility = { status: "not_met", detail: `The listing is open to ${levels.join(", ")} students only.` };
  }

  // 2. Skill alignment.
  const required = [...new Set(opp.requiredSkills.map((s) => s.trim()).filter(Boolean))];
  const supportedBy: FitExplanation["supportedBy"] = [];
  const notShown: string[] = [];
  for (const r of required) {
    const k = norm(r);
    if (student.demonstrated.has(k)) supportedBy.push({ skill: student.demonstrated.get(k)!, evidence: "demonstrated" });
    else if (student.listed.has(k)) supportedBy.push({ skill: student.listed.get(k)!, evidence: "listed" });
    else notShown.push(r);
  }
  const demonstratedCount = supportedBy.filter((s) => s.evidence === "demonstrated").length;
  const profileEmpty = student.demonstrated.size === 0 && student.listed.size === 0;

  let state: FitState;
  let summary: string;
  if (eligibility.status === "not_met") {
    state = "not_eligible";
    summary = eligibility.detail;
  } else if (profileEmpty) {
    state = "insufficient_information";
    summary = "Add skills or connect GitHub so this can be matched to your profile.";
  } else if (required.length === 0) {
    // No published skill requirements: only say what the project's own text mentions. A demonstrated skill
    // named in the topic is relevance evidence (potential fit), never a claim that the skill is required.
    const topic = opp.topicText ? ` ${opp.topicText.replace(/[-_/]/g, " ")} ` : "";
    const mentioned = (m: Map<string, string>) =>
      [...m.entries()].filter(([k]) => k.length >= 2 && new RegExp(`[^a-z0-9+#]${k.replace(/[-_/]/g, " ").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z0-9+#]`, "i").test(topic)).map(([, name]) => name);
    const demo = topic ? mentioned(student.demonstrated) : [];
    const list = topic ? mentioned(student.listed) : [];
    for (const s of demo) supportedBy.push({ skill: s, evidence: "topic" });
    if (demo.length) {
      state = "potential_fit";
      summary = `The project topic mentions ${demo.slice(0, 3).join(", ")}, which you have demonstrated. It doesn't publish required skills, so check the announcement.`;
    } else {
      state = "insufficient_information";
      summary = list.length
        ? `The project topic mentions ${list.slice(0, 3).join(", ")}, which you list but haven't demonstrated yet. It doesn't publish required skills.`
        : "The listing does not name required skills, so fit cannot be assessed.";
    }
  } else if (demonstratedCount > 0 && demonstratedCount * 2 >= required.length) {
    state = "strong_fit";
    summary = `Your evidence in ${supportedBy.filter((s) => s.evidence === "demonstrated").slice(0, 3).map((s) => s.skill).join(", ")} matches what it asks for.`;
  } else if (supportedBy.length > 0) {
    state = "potential_fit";
    const names = supportedBy.slice(0, 3).map((s) => s.skill).join(", ");
    summary = demonstratedCount > 0 ? `You show evidence for some of what it asks (${names}).` : `It asks for ${names}, which you list but have not yet demonstrated.`;
  } else {
    state = "insufficient_information";
    summary = "None of the skills it names are on your profile yet.";
  }
  return { state, summary, supportedBy, notShown, eligibility };
}
