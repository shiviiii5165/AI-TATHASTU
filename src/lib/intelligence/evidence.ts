/**
 * Evidence coverage, confidence and comparability for one student or a group, derived from Student 360 data
 * (lib/intelligence/student.ts). Pure functions: no queries, no writes, no scores. Four separate ideas:
 *
 *   performance   what eligible evidence indicates (the ranking engine; not computed here)
 *   coverage      how much relevant evidence exists
 *   confidence    how reliable the available evidence is (a rule-based level, not a probability)
 *   comparability whether two students' evidence is equivalent enough to compare, dimension by dimension
 *
 * Missing evidence is never treated as low performance, and a broken integration never counts against a student.
 */
import { GRADE_SCALE_LABEL, type GradeScale, parseReportedGrade } from "./grade";
import type { Student360 } from "./student";
import { verificationOfBasis } from "./catalogue";

export type EvidenceState =
  | "verified" //       independently confirmed (matched to code, issuer-verified, external platform)
  | "assessed" //       derived by the career engine or AI from the student's evidence
  | "self_reported" //  stated by the student (or confirmed by them after extraction)
  | "unreviewed" //     extracted from a resume, not yet reviewed by the student
  | "outdated" //       exists but older than its freshness limit
  | "missing" //        nothing recorded
  | "unavailable" //    a connected source is failing, so evidence can't be read right now
  | "not_collected"; // the platform has no source for this yet

export const STATE_LABEL: Record<EvidenceState, string> = {
  verified: "Verified",
  assessed: "Assessed",
  self_reported: "Self-reported",
  unreviewed: "Not reviewed by student",
  outdated: "Outdated",
  missing: "Missing",
  unavailable: "Unavailable (connection problem)",
  not_collected: "Not collected yet",
};

export interface CategoryEvidence {
  id: string;
  label: string;
  state: EvidenceState;
  /** Number of records behind the state. */
  items: number;
  source: string;
  updatedAt: string | null;
  note?: string;
}

/** Freshness limits, in days: older evidence is shown as outdated (still counted as present). */
export const FRESHNESS_DAYS = { intelligence: 180, github: 90, connection: 90 } as const;

const DAY = 86_400_000;
const CONNECTOR_ORIGINS = new Set(["github", "leetcode", "hackerrank", "kaggle", "stack_exchange"]);
const older = (iso: string | null | undefined, days: number, now: Date) => !!iso && now.getTime() - new Date(iso).getTime() > days * DAY;
const newest = (xs: (string | null | undefined)[]) => xs.filter(Boolean).sort().at(-1) ?? null;

/** Fact entries a student has reviewed (confirmed or edited) count as self-reported; rejected ones are ignored. */
function factState(entries: { confirmation: string; createdAt: string }[]): { state: EvidenceState; items: number; updatedAt: string | null } {
  const live = entries.filter((e) => e.confirmation !== "rejected");
  if (!live.length) return { state: "missing", items: 0, updatedAt: null };
  const reviewed = live.some((e) => e.confirmation === "confirmed" || e.confirmation === "edited");
  return { state: reviewed ? "self_reported" : "unreviewed", items: live.length, updatedAt: newest(live.map((e) => e.createdAt)) };
}

export function evidenceCategories(s: Student360, now = new Date()): CategoryEvidence[] {
  const f = s.facts;
  const out: CategoryEvidence[] = [];

  // 1. Profile: the account's own academic fields.
  const profileFields = [s.institution, s.user.degree, s.user.academicYear].filter(Boolean).length;
  out.push({ id: "profile", label: "Profile", state: profileFields ? "self_reported" : "missing", items: profileFields, source: "Account profile (institution, degree, year)", updatedAt: null, note: profileFields ? `${profileFields} of 3 fields filled` : undefined });

  // 2. Education entries.
  out.push({ id: "education", label: "Education", ...factState(f.education ?? []), source: "Resume / profile education" });

  // 3. Academic results: a grade with a clear scale.
  const gradeFacts = (f.education ?? []).filter((e) => e.confirmation !== "rejected" && e.fields.grade);
  const parsed = gradeFacts.map((e) => parseReportedGrade(e.fields.grade)).filter(Boolean);
  out.push({
    id: "academic",
    label: "Academic results",
    state: !gradeFacts.length ? "missing" : parsed.length ? factState(gradeFacts).state : "self_reported",
    items: gradeFacts.length,
    source: "Grade on resume education entry (no institution feed)",
    updatedAt: newest(gradeFacts.map((e) => e.createdAt)),
    note: gradeFacts.length && !parsed.length ? "Grade has no clear scale, so it can't be compared" : parsed[0] ? `On a ${GRADE_SCALE_LABEL[parsed[0]!.scale]}` : undefined,
  });

  // 4. Skills from the career engine: verified when code or an external platform backs at least one skill.
  const skills = s.intel?.skills ?? [];
  const levels = skills.filter((k) => k.proficiency !== null).map((k) => verificationOfBasis(k.evidenceBasis, k.evidenceState));
  const skillState: EvidenceState = !skills.length
    ? "missing"
    : older(s.intel?.computedAt, FRESHNESS_DAYS.intelligence, now)
      ? "outdated"
      : levels.some((v) => v === "verified" || v === "external")
        ? "verified"
        : levels.some((v) => v === "engine" || v === "ai_assessed")
          ? "assessed"
          : "self_reported";
  out.push({ id: "skills", label: "Skills", state: skillState, items: skills.length, source: "Career engine (profile_views)", updatedAt: s.intel?.computedAt ?? null, note: skills.length ? `${levels.length} assessed, ${levels.filter((v) => v === "verified" || v === "external").length} backed by code or an external platform` : undefined });

  // 5. Projects described by the student; 6. projects corroborated by their own repositories.
  // Coverage counts any recorded project (described, or in the merged project list). Ranking eligibility is stricter
  // and unchanged: a project benchmark still needs a described project (lib/intelligence/catalogue.ts).
  // Connector stat rows (LeetCode, GitHub…) also land in the projects group; they aren't projects the student described.
  const described = factState((f.projects ?? []).filter((e) => !CONNECTOR_ORIGINS.has(e.origin)));
  const projectState = described.state === "missing" && s.projects.length ? { state: "self_reported" as const, items: s.projects.length, updatedAt: null } : { ...described, items: Math.max(described.items, s.projects.length) };
  out.push({ id: "projects", label: "Projects", ...projectState, source: described.items ? "Resume / profile projects" : "Merged project list (resume, profile, GitHub)" });
  const matched = s.projects.filter((p) => p.status === "matched").length;
  out.push({
    id: "project_verification",
    label: "Project verification",
    // Without repositories there's nothing to verify against: that's missing evidence, not a failed check.
    state: matched ? "verified" : s.repos.length && described.items ? "self_reported" : "missing",
    items: matched,
    source: "Projects matched to the student's repositories",
    updatedAt: null,
    note: !s.repos.length ? "No repositories to check projects against" : matched ? `${matched} matched to code` : "No described project matched a repository",
  });

  // 7. Resume: any fact that came from a resume.
  const resumeFacts = Object.values(f).flat().filter((e) => e.origin === "resume" && e.confirmation !== "rejected");
  out.push({ id: "resume", label: "Resume", state: resumeFacts.length ? (resumeFacts.some((e) => e.confirmation === "confirmed" || e.confirmation === "edited") ? "self_reported" : "unreviewed") : "missing", items: resumeFacts.length, source: "Resume extraction (profile_facts)", updatedAt: newest(resumeFacts.map((e) => e.createdAt)) });

  // 8. GitHub: an external platform. A failing connection is "unavailable", never held against the student.
  const gh = s.connections.find((c) => c.source === "github");
  const ghState: EvidenceState = !gh
    ? "missing"
    : gh.status === "failed" || gh.status === "reauth_needed"
      ? "unavailable"
      : gh.status === "stale" || older(gh.lastSyncAt, FRESHNESS_DAYS.github, now)
        ? "outdated"
        : s.repos.length || s.github?.total
          ? "verified"
          : "missing";
  out.push({ id: "github", label: "GitHub", state: ghState, items: s.repos.length, source: "GitHub connection (OAuth)", updatedAt: gh?.lastSyncAt ?? s.github?.syncedAt ?? null, note: gh && ghState === "unavailable" ? `Connection ${gh.status.replace("_", " ")}` : undefined });

  // 9. Certifications: issuer-verified learning records, else listed on resume/profile.
  const certs = s.learning.filter((l) => l.kind === "certification");
  const listedCerts = (f.certifications ?? []).filter((e) => e.confirmation !== "rejected");
  out.push({
    id: "certifications",
    label: "Certifications",
    state: certs.some((l) => l.verification === "verified") ? "verified" : certs.length || listedCerts.length ? (listedCerts.length && !certs.length ? factState(listedCerts).state : "self_reported") : "missing",
    items: certs.length + listedCerts.length,
    source: "Learning records, resume certifications",
    updatedAt: newest([...certs.map((l) => l.completedAt ?? l.createdAt), ...listedCerts.map((e) => e.createdAt)]),
  });

  // 10. Learning progress: courses started or completed on the platform.
  const courses = s.learning.filter((l) => l.kind === "course");
  out.push({ id: "learning", label: "Learning progress", state: courses.length ? (courses.some((l) => l.verification === "verified") ? "verified" : "self_reported") : "missing", items: courses.length, source: "Learning records", updatedAt: newest(courses.map((l) => l.completedAt ?? l.createdAt)) });

  // 11. Assessments: no assessment results are stored anywhere yet.
  out.push({ id: "assessments", label: "Assessments", state: "not_collected", items: 0, source: "None yet", updatedAt: null, note: "The platform stores no test or assessment results" });

  // 12. Experience and achievements.
  out.push({ id: "experience", label: "Experience", ...factState(f.experience ?? []), source: "Resume / profile experience" });
  const ach = [...(f.achievements ?? []), ...(f.publications ?? [])];
  const orcid = (f.publications ?? []).some((p) => p.origin === "orcid");
  const achState = factState(ach);
  out.push({ id: "achievements", label: "Achievements & research", ...achState, state: orcid ? "verified" : achState.state, source: "Resume / profile, ORCID" });

  return out;
}

const PRESENT: EvidenceState[] = ["verified", "assessed", "self_reported", "unreviewed", "outdated"];
export const isPresent = (s: EvidenceState) => PRESENT.includes(s);

export interface Coverage {
  covered: number;
  /** Categories the platform can measure for this student right now (the denominator). */
  measurable: number;
  percent: number;
  notCollected: string[];
  unavailable: string[];
  /** Every category considered, before exclusions. */
  applicable: number;
  /** In the denominator. */
  included: string[];
  /** Out of the denominator, each with its reason. */
  excluded: { label: string; reason: string }[];
  withEvidence: string[];
  missing: string[];
  outdated: string[];
  /** Present categories by the strength of their evidence. */
  byLevel: { verified: string[]; assessed: string[]; self_reported: string[]; unreviewed: string[] };
}

/**
 * coverage = categories with any evidence ÷ measurable categories. Measurable excludes what the platform doesn't
 * collect yet and anything blocked by a failing connection, so neither lowers a student's coverage.
 */
export function coverageOf(cats: CategoryEvidence[]): Coverage {
  const notCollected = cats.filter((c) => c.state === "not_collected").map((c) => c.label);
  const unavailable = cats.filter((c) => c.state === "unavailable").map((c) => c.label);
  const included = cats.filter((c) => c.state !== "not_collected" && c.state !== "unavailable").map((c) => c.label);
  const measurable = included.length;
  const present = cats.filter((c) => isPresent(c.state));
  const by = (s: EvidenceState) => present.filter((c) => c.state === s).map((c) => c.label);
  return {
    covered: present.length,
    measurable,
    percent: measurable ? Math.round((present.length / measurable) * 100) : 0,
    notCollected,
    unavailable,
    applicable: cats.length,
    included,
    excluded: [
      ...notCollected.map((label) => ({ label, reason: "The platform has no source for this yet" })),
      ...cats.filter((c) => c.state === "unavailable").map((c) => ({ label: c.label, reason: `${c.note ?? "Connection problem"}: not counted against the student` })),
    ],
    withEvidence: present.map((c) => c.label),
    missing: cats.filter((c) => c.state === "missing").map((c) => c.label),
    outdated: by("outdated"),
    byLevel: { verified: by("verified"), assessed: by("assessed"), self_reported: by("self_reported"), unreviewed: by("unreviewed") },
  };
}

export type ConfidenceLevel = "high" | "moderate" | "low" | "insufficient";
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { high: "High", moderate: "Moderate", low: "Low", insufficient: "Insufficient evidence" };

/**
 * Rule-based reliability of the evidence (not a probability, not calibrated):
 *   insufficient  fewer than 3 categories with evidence
 *   low           no independently verified category, or coverage under 40%
 *   moderate      at least 1 verified category and coverage ≥ 40%
 *   high          at least 3 verified categories and coverage ≥ 70%
 * Then one level lower if half or more of the present categories are outdated, or if most present evidence is
 * unreviewed resume extraction. Contradictions between sources aren't detected yet (listed as a limitation).
 */
export interface ConfidenceCheck {
  rule: string;
  met: boolean;
  detail: string;
}

/** Every confidence rule with whether it holds for this student: the full trace behind the level. */
export function confidenceChecks(cats: CategoryEvidence[]): ConfidenceCheck[] {
  const cov = coverageOf(cats);
  const present = cats.filter((c) => isPresent(c.state));
  const verified = cats.filter((c) => c.state === "verified").length;
  const outdated = present.filter((c) => c.state === "outdated").length;
  const unreviewed = present.filter((c) => c.state === "unreviewed").length;
  return [
    { rule: "At least 3 categories have evidence", met: present.length >= 3, detail: `${present.length} have evidence` },
    { rule: "At least 1 category is independently verified", met: verified >= 1, detail: `${verified} verified` },
    { rule: "At least 3 categories are independently verified", met: verified >= 3, detail: `${verified} verified` },
    { rule: "Coverage is 40% or more", met: cov.percent >= 40, detail: `${cov.percent}% (${cov.covered} of ${cov.measurable})` },
    { rule: "Coverage is 70% or more", met: cov.percent >= 70, detail: `${cov.percent}% (${cov.covered} of ${cov.measurable})` },
    { rule: "Less than half the evidence is outdated", met: present.length === 0 || outdated * 2 < present.length, detail: `${outdated} of ${present.length} outdated` },
    { rule: "At most half the evidence is unreviewed resume extraction", met: present.length === 0 || unreviewed * 2 <= present.length, detail: `${unreviewed} of ${present.length} unreviewed` },
  ];
}

export function confidenceOf(cats: CategoryEvidence[]): { level: ConfidenceLevel; reasons: string[] } {
  const cov = coverageOf(cats);
  const present = cats.filter((c) => isPresent(c.state));
  const verified = cats.filter((c) => c.state === "verified").length;
  const reasons: string[] = [];
  let level: ConfidenceLevel;
  if (present.length < 3) {
    level = "insufficient";
    reasons.push(`Only ${present.length} categor${present.length === 1 ? "y has" : "ies have"} evidence (3 needed).`);
  } else if (verified >= 3 && cov.percent >= 70) {
    level = "high";
    reasons.push(`${verified} categories are independently verified and coverage is ${cov.percent}%.`);
  } else if (verified >= 1 && cov.percent >= 40) {
    level = "moderate";
    reasons.push(`${verified} verified categor${verified === 1 ? "y" : "ies"}; coverage ${cov.percent}%.`);
  } else {
    level = "low";
    reasons.push(verified === 0 ? "No category is independently verified: the evidence is the student's own account." : `Coverage is ${cov.percent}%.`);
  }
  const order: ConfidenceLevel[] = ["insufficient", "low", "moderate", "high"];
  const down = () => { level = order[Math.max(1, order.indexOf(level) - 1)]!; };
  if (level !== "insufficient") {
    const outdated = present.filter((c) => c.state === "outdated").length;
    if (outdated * 2 >= present.length) { down(); reasons.push(`${outdated} of ${present.length} categories are outdated.`); }
    const unreviewed = present.filter((c) => c.state === "unreviewed").length;
    if (unreviewed * 2 > present.length) { down(); reasons.push("Most evidence was extracted from a resume the student hasn't reviewed."); }
  }
  if (cov.unavailable.length) reasons.push(`Not counted against the student: ${cov.unavailable.join(", ")} (connection problem).`);
  return { level, reasons };
}

export type Comparability = "comparable" | "limited" | "not_comparable" | "unavailable";
export const COMPARABILITY_LABEL: Record<Comparability, string> = { comparable: "Comparable", limited: "Compare with care", not_comparable: "Not comparable", unavailable: "Not enough evidence" };

export interface DimensionComparability {
  id: string;
  label: string;
  status: Comparability;
  reasons: string[];
}

export interface Comparable {
  id: string;
  name: string;
  institution: string | null;
  academicYear: string | null;
  categories: CategoryEvidence[];
  grade: { scale: GradeScale; text: string } | null;
  /** Oldest and newest dated evidence: the observation period behind this student's record. */
  period: { from: string | null; to: string | null };
}

// ── Conflicting evidence ─────────────────────────────────────────────────────

export interface ConflictValue {
  value: string;
  /** Where the value came from (resume, profile, ORCID…). */
  source: string;
  recordedAt: string;
  /** The student's review of the entry: unconfirmed, confirmed or edited. */
  review: string;
}

export interface Conflict {
  id: string;
  /** contradiction = established conflict between comparable records; possible = needs a person to check. */
  kind: "contradiction" | "possible";
  type: "Inconsistent dates" | "Different grades for the same qualification" | "Different dates for the same role";
  subject: string;
  values: ConflictValue[];
  explanation: string;
}

/** Only unambiguous ISO-style dates (YYYY, YYYY-MM, YYYY-MM-DD) are compared; anything else isn't judged. */
function parseDay(s: string | undefined): number | null {
  const m = s?.trim().match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), m[2] ? Number(m[2]) - 1 : 0, m[3] ? Number(m[3]) : 1);
}
const norm = (s: string | undefined) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const ORIGIN_LABEL: Record<string, string> = { resume: "Resume", user: "Profile (student)", manual: "Profile (student)", orcid: "ORCID", linkedin: "LinkedIn" };
const val = (e: { origin: string; createdAt: string; confirmation: string }, value: string): ConflictValue => ({ value, source: ORIGIN_LABEL[e.origin] ?? e.origin, recordedAt: e.createdAt, review: e.confirmation });

/**
 * Conflicts that can be established from the records themselves. Nothing is resolved automatically: both values
 * are shown with their source and the student's review state. Differences explained by dates (different end
 * dates) or scales (CGPA vs %) aren't reported at all.
 */
export function detectConflicts(s: Student360): Conflict[] {
  const out: Conflict[] = [];
  const groups: [string, string][] = [["education", "Education"], ["experience", "Experience"]];
  for (const [g, label] of groups) {
    for (const e of s.facts[g] ?? []) {
      const start = parseDay(e.fields.start_date), end = parseDay(e.fields.end_date);
      if (start !== null && end !== null && start > end) {
        out.push({
          id: `dates:${e.key}`, kind: "contradiction", type: "Inconsistent dates",
          subject: `${label}: ${e.fields.degree || e.fields.role || e.fields.institution || e.fields.organization || "entry"}`,
          values: [val(e, `starts ${e.fields.start_date}`), val(e, `ends ${e.fields.end_date}`)],
          explanation: "The start date is after the end date in the same entry.",
        });
      }
    }
  }

  // The same qualification listed twice with different grades.
  const edu = (s.facts.education ?? []).filter((e) => e.fields.grade && (e.fields.institution || e.fields.degree));
  for (let i = 0; i < edu.length; i++) {
    for (let j = i + 1; j < edu.length; j++) {
      const a = edu[i]!, b = edu[j]!;
      if (norm(a.fields.institution) !== norm(b.fields.institution) || norm(a.fields.degree) !== norm(b.fields.degree)) continue;
      const ga = parseReportedGrade(a.fields.grade), gb = parseReportedGrade(b.fields.grade);
      if (!ga || !gb || ga.scale !== gb.scale || ga.percent === gb.percent) continue; // different scales aren't a conflict
      const ea = norm(a.fields.end_date), eb = norm(b.fields.end_date);
      if (ea && eb && ea !== eb) continue; // different terms or years: explained by dates
      out.push({
        id: `grade:${a.key}:${b.key}`,
        kind: ea && eb ? "contradiction" : "possible",
        type: "Different grades for the same qualification",
        subject: [a.fields.degree, a.fields.institution].filter(Boolean).join(", "),
        values: [val(a, a.fields.grade!), val(b, b.fields.grade!)],
        explanation: ea && eb ? "Same qualification and end date, different grades on the same scale." : "Same qualification, different grades; an end date is missing, so they may be different terms.",
      });
    }
  }

  // The same role at the same organisation with different start dates (could be two stints: needs review).
  const exp = (s.facts.experience ?? []).filter((e) => e.fields.organization && e.fields.role);
  for (let i = 0; i < exp.length; i++) {
    for (let j = i + 1; j < exp.length; j++) {
      const a = exp[i]!, b = exp[j]!;
      if (a.origin === b.origin || norm(a.fields.organization) !== norm(b.fields.organization) || norm(a.fields.role) !== norm(b.fields.role)) continue;
      const sa = parseDay(a.fields.start_date), sb = parseDay(b.fields.start_date);
      if (sa === null || sb === null || Math.abs(sa - sb) <= 31 * DAY) continue;
      out.push({
        id: `exp:${a.key}:${b.key}`, kind: "possible", type: "Different dates for the same role",
        subject: `${a.fields.role}, ${a.fields.organization}`,
        values: [val(a, `from ${a.fields.start_date}`), val(b, `from ${b.fields.start_date}`)],
        explanation: "Two sources give different start dates. It may be two separate periods.",
      });
    }
  }
  return out;
}

export function comparableOf(s: Student360, now = new Date()): Comparable {
  const g = (s.facts.education ?? []).filter((e) => e.confirmation !== "rejected" && e.fields.grade).map((e) => parseReportedGrade(e.fields.grade)).find(Boolean);
  const categories = evidenceCategories(s, now);
  const dates = categories.map((c) => c.updatedAt).filter((d): d is string => !!d).sort();
  return {
    id: s.user.id,
    name: s.user.name || s.user.email || "Student",
    institution: s.institution,
    academicYear: (s.user.academicYear as string | null) ?? null,
    categories,
    grade: g ? { scale: g.scale, text: g.text } : null,
    period: { from: dates[0] ?? null, to: dates.at(-1) ?? null },
  };
}

/**
 * Per-dimension comparability across a group. A dimension is unavailable when anyone lacks evidence (named), not
 * comparable when the evidence is on different scales, and limited when verification levels or context differ.
 */
export function compareGroup(students: Comparable[]): { overall: string[]; dimensions: DimensionComparability[] } {
  const overall: string[] = [];
  const years = new Set(students.map((s) => s.academicYear ?? "unknown"));
  if (years.size > 1) overall.push("Different years of study: skills, projects and experience accumulate over time, so earlier-year students are expected to have less.");
  const coverages = students.map((s) => coverageOf(s.categories));
  const covs = coverages.map((c) => c.percent);
  if (Math.max(...covs) - Math.min(...covs) > 30) overall.push(`Evidence coverage differs widely (${Math.min(...covs)}%–${Math.max(...covs)}%): a gap in evidence isn't a gap in ability.`);
  // Coverage percentages are only like-for-like when they share a denominator.
  if (new Set(coverages.map((c) => c.measurable)).size > 1) {
    overall.push(
      `Coverage is measured over different numbers of categories (${students.map((s, i) => `${s.name}: ${coverages[i]!.measurable}`).join(", ")}) because some sources can't be read for some students. Compare the categories, not just the percentages.`,
    );
  }

  const dims: DimensionComparability[] = [];
  const ids = students[0]?.categories.map((c) => c.id) ?? [];
  for (const id of ids) {
    const cats = students.map((s) => s.categories.find((c) => c.id === id)!);
    const label = cats[0]!.label;
    const reasons: string[] = [];
    if (cats.some((c) => c.state === "not_collected")) {
      dims.push({ id, label, status: "unavailable", reasons: ["The platform doesn't collect this yet."] });
      continue;
    }
    const lacking = students.flatMap((s, i) => (isPresent(cats[i]!.state) ? [] : [`${s.name} (${STATE_LABEL[cats[i]!.state].toLowerCase()})`]));
    if (lacking.length) {
      dims.push({ id, label, status: "unavailable", reasons: [`No usable evidence for ${lacking.join(", ")}.`] });
      continue;
    }
    let status: Comparability = "comparable";
    if (id === "academic") {
      const scales = new Set(students.map((s) => s.grade?.scale ?? "none"));
      if (scales.has("none")) {
        dims.push({ id, label, status: "not_comparable", reasons: ["At least one grade has no clear scale."] });
        continue;
      }
      if (scales.size > 1) {
        dims.push({ id, label, status: "not_comparable", reasons: [`Grades are on different scales (${[...scales].map((x) => GRADE_SCALE_LABEL[x as GradeScale]).join(" vs ")}). No conversion between them is assumed.`] });
        continue;
      }
      if (new Set(students.map((s) => s.institution ?? "unknown")).size > 1) {
        status = "limited";
        reasons.push("Same scale, but different institutions grade differently.");
      }
    }
    const verifiedMix = new Set(cats.map((c) => (c.state === "verified" ? "verified" : "other")));
    if (verifiedMix.size > 1) {
      status = "limited";
      reasons.push("Verified for some students, self-reported or assessed for others.");
    }
    if (cats.some((c) => c.state === "outdated")) {
      status = "limited";
      reasons.push("Outdated for at least one student.");
    }
    dims.push({ id, label, status, reasons });
  }
  return { overall, dimensions: dims };
}
