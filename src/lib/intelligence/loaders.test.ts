import { eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

// Every Student Intelligence query against real Postgres (PGlite, all migrations applied, including 0032).
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const S = await import("@/db/schema");
const { loadCatalogue, loadCohort, loadSignals, skillKey } = await import("./catalogue");
const { loadCohortOptions, loadOverview } = await import("./overview");
const { autoDefinition, previousSnapshot, runRanking, studentRankHistory, toSnapshotRows, listProfiles } = await import("./rankings");
const { cohortKey } = await import("./engine");
const { loadStudent360 } = await import("./student");

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";
const C = "00000000-0000-4000-8000-0000000000c3";
const FACULTY = "00000000-0000-4000-8000-0000000000f4";

async function seed() {
  const [inst] = await db.insert(S.institutions).values({ canonicalName: "Test University", verificationStatus: "verified", source: "seed" }).returning();
  await db.insert(S.users).values([
    { id: A, email: "a@example.com", name: "Asha", institutionId: inst.id, university: "Test University", currentAcademicYear: "3rd Year" },
    { id: B, email: "b@example.com", name: "Bilal", institutionId: inst.id, university: "Test University", currentAcademicYear: "2nd Year" },
    { id: C, email: "c@example.com", name: "Chen", currentAcademicYear: "3rd Year" },
    { id: FACULTY, email: "f@example.com", name: "Prof", role: "faculty" },
  ]);
  await db.insert(S.onboardingState).values([{ userId: A, careerRole: "ml_engineer" }, { userId: B, careerRole: "ml_engineer" }, { userId: C }]);
  const [py] = await db.insert(S.skills).values({ canonicalName: "Python", category: "language" }).returning();
  await db.insert(S.skills).values({ canonicalName: "Robotics Kinematics", category: "other" }); // any skill, no fixed list
  const doc = (prof: number, basis: string) => ({
    version: 1, computedAt: "2026-11-10T00:00:00Z", intelligence: {
      engineVersion: 4, computedAt: "2026-11-10T00:00:00Z", hasEvidenceBase: true,
      skills: [{ name: "Python", category: "language", status: "verified", evidenceBasis: basis, proficiency: prof, level: "Working", confidence: 0.8, evidenceCount: 2, evidence: [], lastEvidenceAt: "2026-11-01T00:00:00Z", levelBasis: ["Code in 3 repositories"] },
               { name: "Docker", category: "tool", status: "claimed", evidenceBasis: "inferred", proficiency: null, level: "Not assessed", confidence: 0, evidenceCount: 0, evidence: [], lastEvidenceAt: null }],
      inferred: [], roles: [], unsupportedRoles: [], recommendations: [], roadmap: null, graph: { nodes: [], edges: [], totalSkills: 0 }, counts: { verified: 1, claimed: 0, inferred: 0, assessed: 1 },
    },
  });
  await db.insert(S.profileViews).values([{ userId: A, view: doc(70, "demonstrated") }, { userId: B, view: doc(40, "described") }]);
  await db.insert(S.erisScores).values([{ userId: A, role: "ml_engineer", score: 0.62, breakdownJson: { components: { technical: 0.7 } } }, { userId: A, role: "data_scientist", score: 0.4, breakdownJson: {} }]);
  await db.insert(S.githubContributions).values({
    userId: A, totalContributions: 420, days: [{ date: "2026-11-01", count: 3, level: 2 }, { date: "2026-11-02", count: 0, level: 0 }], syncedAt: new Date(),
    rangeStart: new Date("2025-11-02"), rangeEnd: new Date("2026-11-02"), categoryTotals: { commits: 300, pullRequests: 20, issues: 5, reviews: 3, repositories: 2, restricted: 0 },
    repositories: [], hasRestrictedContributions: false, githubLogin: "asha",
  });
  await db.insert(S.codeRepositories).values([{ userId: A, source: "github", repoName: "asha/x", stars: 5, languages: { Python: 1000 } }, { userId: A, source: "github", repoName: "asha/y", stars: 1 }]);
  await db.insert(S.githubScores).values([
    { userId: A, repoId: "1", repoName: "asha/x", impactScore: 72, rationale: "Useful tool" },
    { userId: A, repoId: "2", repoName: "asha/y", impactScore: 10, rationale: "Estimated from repository metadata (no AI consent)" },
  ]);
  await db.insert(S.profileFacts).values([
    { userId: A, fieldGroup: "publications", fieldName: "title", recordKey: "p1", origin: "orcid", extractedValue: "Paper one" },
    { userId: A, fieldGroup: "publications", fieldName: "title", recordKey: "p2", origin: "resume", extractedValue: "Paper two" },
    { userId: B, fieldGroup: "experience", fieldName: "role", recordKey: "e1", origin: "resume", extractedValue: "Intern" },
    { userId: B, fieldGroup: "experience", fieldName: "organization", recordKey: "e1", origin: "resume", extractedValue: "Acme" },
    { userId: B, fieldGroup: "education", fieldName: "grade", recordKey: "ed1", origin: "resume", extractedValue: "CGPA 8.4/10" },
    { userId: B, fieldGroup: "achievements", fieldName: "title", recordKey: "a1", origin: "resume", extractedValue: "Hackathon winner", confirmation: "rejected" },
    { userId: B, fieldGroup: "achievements", fieldName: "title", recordKey: "hr:badge", origin: "hackerrank", extractedValue: "Problem Solving badge" },
    // Evidence in free text, awaiting the student's review (unconfirmed still counts as self-reported; rejected never).
    { userId: B, fieldGroup: "achievements", fieldName: "title", recordKey: "a2", origin: "resume", extractedValue: "Winner, Smart India Hackathon 2025", normalizedValue: "Winner, Smart India Hackathon 2025" },
    { userId: B, fieldGroup: "achievements", fieldName: "description", recordKey: "a2", origin: "resume", extractedValue: "Team lead; patent filed for the device", normalizedValue: "Team lead; patent filed for the device" },
    { userId: B, fieldGroup: "experience", fieldName: "role", recordKey: "e2", origin: "resume", extractedValue: "Summer Intern", normalizedValue: "Summer Intern" },
    { userId: A, fieldGroup: "projects", fieldName: "title", recordKey: "pr1", origin: "resume", extractedValue: "Asha X", normalizedValue: "Asha X" },
    { userId: A, fieldGroup: "projects", fieldName: "description", recordKey: "pr1", origin: "resume", extractedValue: "d", normalizedValue: "d" },
    { userId: B, fieldGroup: "projects", fieldName: "title", recordKey: "pr2", origin: "resume", extractedValue: "Lone project", confirmation: "rejected" },
    { userId: C, fieldGroup: "projects", fieldName: "title", recordKey: "leetcode:stats", origin: "leetcode", extractedValue: { easy: 10, medium: 5, hard: 1 } },
  ]);
  await db.insert(S.unifiedProjects).values([{ userId: A, canonicalTitle: "X", status: "matched" }, { userId: B, canonicalTitle: "Y" }]);
  await db.insert(S.learningRecords).values([
    { userId: B, kind: "certification", title: "Cloud Cert", source: "user", verification: "verified", status: "completed" },
    { userId: B, kind: "course", title: "Course", source: "user", status: "completed" },
  ]);
  return { py };
}

describe("Student Intelligence loaders on real Postgres", async () => {
  const { py } = await seed();

  it("builds the catalogue from the skills table (no fixed skill list)", async () => {
    const { byKey } = await loadCatalogue();
    expect(byKey.get(skillKey(py.id))?.label).toBe("Python");
    expect([...byKey.values()].some((b) => b.label === "Robotics Kinematics")).toBe(true);
  });

  it("loads only active students into the cohort, with filters", async () => {
    expect((await loadCohort({})).map((s) => s.id).sort()).toEqual([A, B, C]);
    expect((await loadCohort({ academicYear: "3rd Year" })).map((s) => s.id).sort()).toEqual([A, C]);
  });

  it("reads every signal with its verification, and leaves missing evidence missing", async () => {
    const { skills } = await loadCatalogue();
    const m = await loadSignals({}, skills);
    const a = m.get(A)!;
    expect(a.get(skillKey(py.id))).toMatchObject({ value: 70, verification: "verified" });
    expect(a.get("readiness.eris")?.value).toBeCloseTo(62); // primary goal only
    expect(a.get("github.contributions_year")?.value).toBe(420);
    expect(a.get("github.active_days")?.value).toBe(1);
    expect(a.get("github.repositories")?.value).toBe(2);
    expect(a.get("github.stars")?.value).toBe(6);
    expect(a.get("github.repo_impact")).toMatchObject({ value: 72, verification: "ai_assessed" });
    expect(a.get("research.publications_orcid")).toMatchObject({ value: 1, verification: "external" });
    expect(a.get("research.publications_listed")).toMatchObject({ value: 1, verification: "self_reported" });
    expect(a.get("projects.total")?.value).toBe(1); // two fields, one entry
    expect(a.get("projects.corroborated")?.value).toBe(1); // from unified_projects (no admin view on this student)
    const b = m.get(B)!;
    expect(b.get(skillKey(py.id))?.verification).toBe("self_reported");
    expect(b.get("experience.positions")?.value).toBe(2); // e1 (two fields, one entry) + e2
    expect(b.get("experience.internships")?.value).toBe(2); // e1 "Intern" and e2 "Summer Intern"
    expect(b.get("achievements.competitions")?.value).toBe(1);
    expect(b.get("research.patents")?.value).toBe(1);
    expect(b.get("achievements.listed")?.value).toBe(1); // the hackathon entry; the rejected one and the HackerRank badge don't count
    expect(b.has("projects.total")).toBe(false); // only a rejected project: no evidence, not 0
    expect(b.has("projects.corroborated")).toBe(false); // no repositories: not measurable, not 0
    expect(m.get(C)!.has("projects.corroborated")).toBe(false);
    expect(b.get("academic.reported_grade")?.value).toBe(84);
    expect(b.get("credentials.verified_certifications")?.value).toBe(1);
    expect(b.get("learning.courses_completed")?.value).toBe(1);
    expect(b.has("github.contributions_year")).toBe(false);
    expect(m.get(C)!.get("problem.leetcode_weighted")?.value).toBe(23);
    expect(m.has(FACULTY)).toBe(false);
  });

  it("prefers the admin view (incl. unreviewed facts) for skills, ERIS and project matches", async () => {
    const D = "00000000-0000-4000-8000-0000000000d5";
    await db.insert(S.users).values({ id: D, email: "d@example.com", name: "Dev" });
    await db.insert(S.onboardingState).values({ userId: D, careerRole: "ml_engineer", currentStep: "resume" });
    await db.insert(S.codeRepositories).values({ userId: D, source: "github", repoName: "dev/rag-pipeline" });
    await db.insert(S.profileFacts).values({ userId: D, fieldGroup: "projects", fieldName: "title", recordKey: "p", origin: "resume", extractedValue: "RAG Pipeline", normalizedValue: "RAG Pipeline" });
    await db.insert(S.profileViews).values({ userId: D, view: {
      version: 1, intelligence: { skills: [] },
      admin: { basis: "includes_unreviewed", unreviewedFacts: 4, onboardingComplete: false,
        intelligence: { skills: [{ name: "Python", proficiency: 30, level: "Working", evidenceBasis: "described" }] },
        eris: { ml_engineer: 0.41 }, projects: { total: 1, matched: 1 } },
    } });
    const { skills } = await loadCatalogue();
    const d = (await loadSignals({}, skills)).get(D)!;
    expect(d.get(skillKey(py.id))).toMatchObject({ value: 30, verification: "self_reported" });
    expect(d.get("readiness.eris")?.value).toBeCloseTo(41);
    expect(d.get("readiness.eris")?.source).toContain("awaiting review");
    expect(d.get("projects.corroborated")?.value).toBe(1);
    const s = (await loadStudent360(D))!;
    expect(s.admin).toMatchObject({ basis: "includes_unreviewed", unreviewedFacts: 4, onboardingComplete: false });
    expect(s.intel?.skills[0].name).toBe("Python");
    await db.delete(S.users).where(eq(S.users.id, D));
  });

  it("runs the auto ranking end to end", async () => {
    const run = await runRanking(null);
    expect(run.results).toHaveLength(3);
    expect(run.definition.categories.reduce((s, c) => s + c.weight, 0)).toBe(100);
    for (const c of run.definition.categories) expect(c.benchmarks.reduce((s, b) => s + b.weight, 0)).toBe(100);
    const { skills } = await loadCatalogue();
    expect(autoDefinition(await loadSignals({}, skills)).categories.some((c) => c.name === "Platform engagement")).toBe(false);
  });

  it("stores profiles, versions and snapshots (migration 0032 applied) and reads rank history", async () => {
    expect((await listProfiles()).available).toBe(true);
    const run = await runRanking(null);
    const [p] = await db.insert(S.intelligenceRankingProfiles).values({ name: "Test", definition: run.definition, createdByEmail: "x", updatedByEmail: "x", publishedVersion: 1, status: "published" }).returning();
    await db.insert(S.intelligenceRankingVersions).values({ profileId: p.id, version: 1, definition: run.definition, publishedByEmail: "x" });
    const rows = toSnapshotRows(run.results);
    await db.insert(S.intelligenceRankingSnapshots).values({ profileId: p.id, version: 1, cohortKey: cohortKey({}), rankedCount: rows.filter((r) => r.eligible).length, ineligibleCount: 0, results: rows, computedByEmail: "x" });
    expect((await previousSnapshot(p.id, 1, "all"))?.results).toHaveLength(3);
    const hist = await studentRankHistory(A);
    expect(hist).toHaveLength(1);
    expect(hist[0].name).toBe("Test");
  });

  it("loads the overview and the cohort options", async () => {
    const o = await loadOverview({});
    expect(o.totals.students).toBe(3);
    expect(o.totals.withIntelligence).toBe(2);
    expect(o.totals.withGithub).toBe(1);
    expect(o.registrations).toHaveLength(12);
    expect(o.byInstitution.find((r) => r.label === "Test University")?.students).toBe(2);
    expect(o.skillLeaders.find((s) => s.label === "Python")?.students).toBe(2);
    const opts = await loadCohortOptions();
    expect(opts.institutionId.map((x) => x.label)).toEqual(["Test University"]);
    expect(opts.academicYear.map((x) => x.value)).toEqual(["2nd Year", "3rd Year"]);
  });

  it("loads a Student 360 with a dated timeline", async () => {
    const s = (await loadStudent360(A))!;
    expect(s.user.name).toBe("Asha");
    expect(s.institution).toBe("Test University");
    expect(s.eris.map((e) => e.role)).toEqual(["ml_engineer", "data_scientist"]);
    expect(s.repos[0]).toMatchObject({ name: "asha/x", impact: 72 });
    expect(s.facts.publications).toHaveLength(2);
    expect(s.github?.days).toHaveLength(2);
    expect(s.timeline.length).toBeGreaterThan(0);
    for (let i = 1; i < s.timeline.length; i++) expect(Date.parse(s.timeline[i - 1].at)).toBeGreaterThanOrEqual(Date.parse(s.timeline[i].at));
    expect(await loadStudent360("not-a-uuid")).toBeNull();
  });
});

describe("grade scales", () => {
  it("a cohort mixing CGPA and percentages gets no grade benchmark (no evidence, not 0); one scale keeps it", async () => {
    const { skills } = await loadCatalogue();
    // B already has "CGPA 8.4/10". Alone in the 2nd-year cohort, the grade is used.
    expect((await loadSignals({ academicYear: "2nd Year" }, skills)).get(B)?.get("academic.reported_grade")?.value).toBe(84);
    await db.insert(S.profileFacts).values({ userId: C, fieldGroup: "education", fieldName: "grade", recordKey: "edc", origin: "resume", extractedValue: "78%" });
    const mixed = await loadSignals({}, skills);
    expect(mixed.get(B)?.has("academic.reported_grade") ?? false).toBe(false);
    expect(mixed.get(C)?.has("academic.reported_grade") ?? false).toBe(false);
  });
});

describe("snapshot immutability", () => {
  it("regression: later evidence changes never rewrite a stored snapshot or its version", async () => {
    const run = await runRanking(null);
    const [p] = await db.insert(S.intelligenceRankingProfiles).values({ name: "Frozen", definition: run.definition, createdByEmail: "x", updatedByEmail: "x", publishedVersion: 1, status: "published" }).returning();
    await db.insert(S.intelligenceRankingVersions).values({ profileId: p.id, version: 1, definition: run.definition, publishedByEmail: "x" });
    const rows = toSnapshotRows(run.results);
    await db.insert(S.intelligenceRankingSnapshots).values({ profileId: p.id, version: 1, cohortKey: cohortKey({}), rankedCount: rows.filter((r) => r.eligible).length, ineligibleCount: rows.filter((r) => !r.eligible).length, results: rows, computedByEmail: "x" });
    const before = await previousSnapshot(p.id, 1, cohortKey({}));
    // New evidence arrives for a student.
    await db.insert(S.learningRecords).values({ userId: C, kind: "certification", title: "New Cert", source: "user", verification: "verified", status: "completed" });
    await runRanking(null);
    const after = await previousSnapshot(p.id, 1, cohortKey({}));
    expect(after?.results).toEqual(before?.results);
    const [ver] = await db.select().from(S.intelligenceRankingVersions).where(eq(S.intelligenceRankingVersions.profileId, p.id));
    expect(ver.version).toBe(1);
  });
});
