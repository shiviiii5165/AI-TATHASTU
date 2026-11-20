import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

const { compareGroup, comparableOf, confidenceOf, coverageOf, evidenceCategories } = await import("./evidence");
type S360 = Parameters<typeof evidenceCategories>[0];

const NOW = new Date("2026-11-20T00:00:00Z");
const recent = "2026-11-01T00:00:00Z";
const old = "2025-01-01T00:00:00Z";
const fact = (fields: Record<string, string>, confirmation = "confirmed", origin = "resume") => ({ key: Math.random().toString(36), origin, confirmation, fields, createdAt: recent });

function student(over: Partial<S360> & { id?: string; year?: string } = {}): S360 {
  return {
    user: { id: over.id ?? "u1", name: over.id ?? "Student", email: null, degree: "B.Tech", academicYear: over.year ?? "3rd year" } as never,
    institution: "IIT Hyderabad",
    goal: { role: null, label: null, other: null, priorities: [] },
    view: null,
    viewUpdatedAt: null,
    intel: null,
    admin: { basis: null, unreviewedFacts: 0, onboardingComplete: true, projects: null },
    eris: [],
    connections: [],
    github: null,
    repos: [],
    projects: [],
    facts: {},
    learning: [],
    milestones: [],
    opportunities: [],
    integrations: [],
    timeline: [],
    ...over,
  } as S360;
}

const cat = (s: S360, id: string) => evidenceCategories(s, NOW).find((c) => c.id === id)!;

describe("evidence categories", () => {
  it("missing evidence is 'missing', never a score; assessments are not collected", () => {
    const s = student();
    expect(cat(s, "projects").state).toBe("missing");
    expect(cat(s, "academic").state).toBe("missing");
    expect(cat(s, "assessments").state).toBe("not_collected");
  });

  it("unreviewed resume extraction stays a claim; reviewed is self-reported; rejected is ignored", () => {
    expect(cat(student({ facts: { experience: [fact({ role: "Intern" }, "unconfirmed")] } }), "experience").state).toBe("unreviewed");
    expect(cat(student({ facts: { experience: [fact({ role: "Intern" }, "edited")] } }), "experience").state).toBe("self_reported");
    expect(cat(student({ facts: { experience: [fact({ role: "Intern" }, "rejected")] } }), "experience").state).toBe("missing");
  });

  it("a project in the merged list counts as present even without a described entry, and never shows 'missing' with a count", () => {
    const c = cat(student({ projects: [{ title: "Resume Parser", technologies: [], status: "standalone", confidence: 0.5, start: null, end: null }] }), "projects");
    expect(c).toMatchObject({ state: "self_reported", items: 1 });
  });

  it("projects are verified only when matched to the student's own code", () => {
    const base = { facts: { projects: [fact({ title: "Parser" })] } };
    expect(cat(student(base), "project_verification").state).toBe("missing"); // no repos to check against
    const withRepo = { ...base, repos: [{ name: "parser", url: null, stars: 0, languages: {}, lastCommitAt: null, impact: null, rationale: null }] };
    expect(cat(student(withRepo), "project_verification").state).toBe("self_reported");
    expect(cat(student({ ...withRepo, projects: [{ title: "Parser", technologies: [], status: "matched", confidence: 0.9, start: null, end: null }] }), "project_verification").state).toBe("verified");
  });

  it("a failing GitHub connection is unavailable and doesn't lower coverage; an old sync is outdated", () => {
    const failing = student({ connections: [{ source: "github", status: "failed", lastSyncAt: recent, staleAfter: null }] });
    expect(cat(failing, "github").state).toBe("unavailable");
    const withConnection = coverageOf(evidenceCategories(failing, NOW));
    const without = coverageOf(evidenceCategories(student(), NOW));
    expect(withConnection.measurable).toBe(without.measurable - 1);
    expect(withConnection.unavailable).toEqual(["GitHub"]);
    const stale = student({ connections: [{ source: "github", status: "connected", lastSyncAt: old, staleAfter: null }], repos: [{ name: "r", url: null, stars: 0, languages: {}, lastCommitAt: null, impact: null, rationale: null }] });
    expect(cat(stale, "github").state).toBe("outdated");
  });

  it("engine skills are verified only when code or an external platform backs one", () => {
    const intel = (basis: string, computedAt = recent) => ({ engineVersion: "1", computedAt, skills: [{ name: "Python", proficiency: 60, evidenceBasis: basis, evidenceState: "", level: "Working", evidenceCount: 1 }] }) as never;
    expect(cat(student({ intel: intel("demonstrated") }), "skills").state).toBe("verified");
    expect(cat(student({ intel: intel("detected") }), "skills").state).toBe("assessed");
    expect(cat(student({ intel: intel("claimed") }), "skills").state).toBe("self_reported");
    expect(cat(student({ intel: intel("demonstrated", old) }), "skills").state).toBe("outdated");
  });
});

describe("coverage and confidence", () => {
  it("coverage has an explicit denominator excluding what can't be measured", () => {
    const c = coverageOf(evidenceCategories(student(), NOW));
    expect(c.measurable).toBe(12); // 13 categories minus assessments (not collected)
    expect(c.notCollected).toEqual(["Assessments"]);
    expect(c.covered).toBe(1); // profile fields only
  });

  it("confidence is insufficient with little evidence, low with only claims, higher with verification", () => {
    expect(confidenceOf(evidenceCategories(student(), NOW)).level).toBe("insufficient");
    const claims = student({ facts: { education: [fact({ degree: "B.Tech" })], experience: [fact({ role: "Intern" })], achievements: [fact({ title: "Hackathon" })] } });
    const low = confidenceOf(evidenceCategories(claims, NOW));
    expect(low.level).toBe("low");
    expect(low.reasons.join(" ")).toContain("No category is independently verified");
    const verified = student({
      facts: { education: [fact({ degree: "B.Tech" })], projects: [fact({ title: "Parser" })], experience: [fact({ role: "Intern" })], certifications: [fact({ name: "AWS" })], publications: [fact({ title: "Paper" }, "confirmed", "orcid")] },
      projects: [{ title: "Parser", technologies: [], status: "matched", confidence: 0.9, start: null, end: null }],
      repos: [{ name: "parser", url: null, stars: 0, languages: {}, lastCommitAt: null, impact: null, rationale: null }],
      connections: [{ source: "github", status: "connected", lastSyncAt: recent, staleAfter: null }],
      learning: [{ kind: "certification", title: "AWS", provider: "AWS", status: "completed", verification: "verified", url: null, completedAt: recent, createdAt: recent, skills: [] }],
    });
    expect(confidenceOf(evidenceCategories(verified, NOW)).level).toBe("high");
  });

  it("mostly unreviewed evidence lowers confidence a level", () => {
    const s = student({
      facts: { education: [fact({ degree: "x" }, "unconfirmed")], experience: [fact({ role: "x" }, "unconfirmed")], achievements: [fact({ title: "x" }, "unconfirmed")], projects: [fact({ title: "P" }, "unconfirmed")] },
      projects: [{ title: "P", technologies: [], status: "matched", confidence: 0.9, start: null, end: null }],
      repos: [{ name: "p", url: null, stars: 0, languages: {}, lastCommitAt: null, impact: null, rationale: null }],
      connections: [{ source: "github", status: "connected", lastSyncAt: recent, staleAfter: null }],
    });
    const c = confidenceOf(evidenceCategories(s, NOW));
    expect(c.reasons.join(" ")).toContain("hasn't reviewed");
  });
});

describe("comparability", () => {
  const grade = (g: string) => ({ facts: { education: [fact({ degree: "B.Tech", grade: g })] } });

  it("CGPA and percentage are not comparable; the same scale at different institutions needs care", () => {
    const a = comparableOf(student({ id: "A", ...grade("CGPA 8.6/10") }), NOW);
    const b = comparableOf(student({ id: "B", ...grade("86%") }), NOW);
    const academic = compareGroup([a, b]).dimensions.find((d) => d.id === "academic")!;
    expect(academic.status).toBe("not_comparable");
    expect(academic.reasons[0]).toContain("different scales");

    const c = comparableOf(student({ id: "C", ...grade("8.1/10"), institution: "NIT Trichy" }), NOW);
    expect(compareGroup([a, c]).dimensions.find((d) => d.id === "academic")!.status).toBe("limited");
    const d = comparableOf(student({ id: "D", ...grade("7.9/10") }), NOW);
    expect(compareGroup([a, d]).dimensions.find((x) => x.id === "academic")!.status).toBe("comparable");
  });

  it("a dimension someone lacks is unavailable (and names them); not-collected stays unavailable", () => {
    const a = comparableOf(student({ id: "A", facts: { projects: [fact({ title: "P" })] } }), NOW);
    const b = comparableOf(student({ id: "B" }), NOW);
    const g = compareGroup([a, b]);
    const projects = g.dimensions.find((d) => d.id === "projects")!;
    expect(projects.status).toBe("unavailable");
    expect(projects.reasons[0]).toContain("B (missing)");
    expect(g.dimensions.find((d) => d.id === "assessments")!.status).toBe("unavailable");
  });

  it("calls out different years of study and wide coverage gaps", () => {
    const a = comparableOf(student({ id: "A", year: "1st year" }), NOW);
    const b = comparableOf(student({ id: "B", year: "4th year", facts: { education: [fact({ d: "x" })], experience: [fact({ r: "x" })], achievements: [fact({ t: "x" })], projects: [fact({ t: "x" })] } }), NOW);
    const notes = compareGroup([a, b]).overall.join(" ");
    expect(notes).toContain("Different years of study");
    expect(notes).toContain("a gap in evidence isn't a gap in ability");
  });
});

describe("coverage transparency", () => {
  it("lists the denominator, every exclusion with its reason, and evidence by strength", async () => {
    const { coverageOf: cov } = await import("./evidence");
    const s = student({ connections: [{ source: "github", status: "reauth_needed", lastSyncAt: recent, staleAfter: null }], facts: { experience: [fact({ role: "Intern" }, "unconfirmed")] } });
    const c = cov(evidenceCategories(s, NOW));
    expect(c.applicable).toBe(13);
    expect(c.measurable).toBe(11);
    expect(c.excluded.map((x) => x.label).sort()).toEqual(["Assessments", "GitHub"]);
    expect(c.excluded.find((x) => x.label === "GitHub")!.reason).toContain("not counted against the student");
    // An unreviewed resume entry makes both the entry's category and "Resume" unreviewed.
    expect(c.byLevel.unreviewed).toEqual(["Resume", "Experience"]);
    expect(c.missing).toContain("Projects");
  });

  it("comparison calls out different denominators", () => {
    const a = comparableOf(student({ id: "A" }), NOW);
    const b = comparableOf(student({ id: "B", connections: [{ source: "github", status: "failed", lastSyncAt: recent, staleAfter: null }] }), NOW);
    expect(compareGroup([a, b]).overall.join(" ")).toMatch(/different numbers of categories \(A: 12, B: 11\)/);
  });
});

describe("confidence trace", () => {
  it("reports each rule with whether it holds", async () => {
    const { confidenceChecks } = await import("./evidence");
    const checks = confidenceChecks(evidenceCategories(student(), NOW));
    expect(checks.find((c) => c.rule.startsWith("At least 3 categories have evidence"))!.met).toBe(false);
    expect(checks).toHaveLength(7);
  });
});

describe("conflicting evidence", () => {
  it("flags start-after-end dates as a contradiction; leaves unparseable dates alone", async () => {
    const { detectConflicts } = await import("./evidence");
    const s = student({ facts: { experience: [fact({ role: "Intern", organization: "Acme", start_date: "2025-06", end_date: "2024-01" }), fact({ role: "Dev", organization: "B", start_date: "June 2025", end_date: "Jan 2024" })] } });
    const c = detectConflicts(s);
    expect(c).toHaveLength(1);
    expect(c[0]).toMatchObject({ kind: "contradiction", type: "Inconsistent dates" });
  });

  it("same qualification, same end date, different grades on one scale: contradiction; different scales or dates: no conflict", async () => {
    const { detectConflicts } = await import("./evidence");
    const ed = (grade: string, end: string, origin = "resume") => fact({ institution: "IIT Hyderabad", degree: "B.Tech", grade, end_date: end }, "confirmed", origin);
    expect(detectConflicts(student({ facts: { education: [ed("8.6/10", "2026"), ed("7.9/10", "2026", "user")] } }))[0]).toMatchObject({ kind: "contradiction", type: "Different grades for the same qualification" });
    expect(detectConflicts(student({ facts: { education: [ed("8.6/10", "2026"), ed("86%", "2026", "user")] } }))).toEqual([]); // different scales
    expect(detectConflicts(student({ facts: { education: [ed("8.6/10", "2025"), ed("7.9/10", "2026", "user")] } }))).toEqual([]); // different terms
    expect(detectConflicts(student({ facts: { education: [ed("8.6/10", ""), ed("7.9/10", "2026", "user")] } }))[0]!.kind).toBe("possible");
  });

  it("different start dates for the same role across sources is only a possible inconsistency, with both sources", async () => {
    const { detectConflicts } = await import("./evidence");
    const s = student({ facts: { experience: [fact({ role: "Intern", organization: "Acme", start_date: "2024-01" }, "confirmed", "resume"), fact({ role: "intern", organization: "ACME", start_date: "2025-01" }, "edited", "linkedin")] } });
    const [c] = detectConflicts(s);
    expect(c).toMatchObject({ kind: "possible", type: "Different dates for the same role" });
    expect(c!.values.map((v) => v.source)).toEqual(["Resume", "LinkedIn"]);
    expect(c!.values[1]!.review).toBe("edited");
  });
});
