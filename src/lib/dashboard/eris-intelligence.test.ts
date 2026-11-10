import { describe, expect, it } from "vitest";

import type { IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";

import { credit, creditKind, gapNote, intelligenceScore, priorityGaps, standingView } from "./eris-intelligence";

const row = (skill: string, extra: Partial<RoleSkillRow> = {}): RoleSkillRow => ({
  skill,
  tier: "required",
  evidenceRequirement: "independent",
  evidenceState: "demonstrated",
  weight: 1,
  priority: "High",
  expected: 50,
  expectedLevel: "Proficient",
  proficiency: 50,
  level: "Proficient",
  confidence: 0.8,
  state: "met",
  insufficientEvidence: false,
  action: null,
  evidence: [],
  ...extra,
});

const role = (skills: RoleSkillRow[], extra: Partial<RoleAnalysis> = {}): RoleAnalysis => ({
  role: "ml_engineer",
  coverage: 0,
  assessed: true,
  skills,
  open: skills.filter((s) => s.state !== "met"),
  counts: { met: 0, underdeveloped: 0, unverified: 0, inferred: 0, missing: 0, not_assessed: 0 },
  alignment: { state: "developing", label: "Developing alignment", required: 0, requiredMet: 0, requiredAssessed: 0, requiredClaimedOnly: 0, requiredMissing: 0, supporting: 0, supportingMet: 0, criticalGaps: [], foundationsMet: false },
  ...extra,
});

const none = (skill: string, extra: Partial<RoleSkillRow> = {}) => row(skill, { proficiency: null, level: "Not assessed", state: "missing", gapType: "missing_competency", evidenceState: undefined, ...extra });

describe("ERIS — Intelligence Score", () => {
  it("is the weighted share of the framework backed by evidence", () => {
    // Python fully met (w 1), SQL half the expected level (w 1) → (1 + 0.5) / 2 = 75
    expect(intelligenceScore(role([row("Python"), row("SQL", { proficiency: 25, state: "underdeveloped" })]))?.score).toBe(75);
  });

  it("weights competencies by the framework's weights", () => {
    expect(intelligenceScore(role([row("A", { weight: 3 }), none("B", { weight: 1 })]))?.score).toBe(75);
  });

  it("caps attainment at the expected level, so exceeding it can't inflate the score", () => {
    expect(intelligenceScore(role([row("A", { proficiency: 100 }), none("B")]))?.score).toBe(50);
  });

  it("halves credit when only the student's descriptions back a skill that needs independent proof", () => {
    const described = row("A", { evidenceState: "unverified", state: "unverified" });
    expect(creditKind(described)).toBe("described");
    expect(credit(described)).toBe(0.5);
    // A competency whose framework accepts described evidence keeps full credit.
    expect(credit(row("B", { evidenceRequirement: "described", evidenceState: "unverified" }))).toBe(1);
  });

  it("gives claimed, suggested and missing competencies no credit, never a level", () => {
    for (const r of [none("A", { state: "unverified", gapType: "claimed_unverified", evidenceState: "claimed" }), none("B", { state: "inferred" }), none("C")]) {
      expect(creditKind(r)).toBe("none");
      expect(credit(r)).toBe(0);
    }
  });

  it("counts a duplicated competency once", () => {
    expect(intelligenceScore(role([row("Python"), row("python"), none("SQL")]))?.score).toBe(50);
  });

  it("returns no score, not zero, when nothing is evidenced or the engine couldn't assess", () => {
    expect(intelligenceScore(role([none("A"), none("B")]))).toBeNull();
    expect(intelligenceScore(role([row("A")], { assessed: false }))).toBeNull();
    expect(intelligenceScore(role([row("A")], { alignment: { ...role([]).alignment!, state: "not_enough_evidence" } }))).toBeNull();
    expect(intelligenceScore(null)).toBeNull();
    expect(intelligenceScore(role([row("A", { weight: 0 })]))).toBeNull();
  });

  it("breaks the score into required and supporting parts with honest counts", () => {
    const s = intelligenceScore(role([row("A"), none("B"), row("C", { tier: "supporting", evidenceState: "unverified", state: "unverified" })]))!;
    expect(s.required).toMatchObject({ score: 50, competencies: 2 });
    expect(s.supporting).toMatchObject({ score: 50, competencies: 1 });
    expect(s.counts).toEqual({ evidenced: 1, described: 1, none: 1 });
  });
});

describe("Where you stand view", () => {
  const doc = (roles: RoleAnalysis[], extra: Partial<IntelligenceDoc> = {}) =>
    ({ engineVersion: 3, computedAt: "2026-11-01T10:00:00Z", hasEvidenceBase: true, skills: [], inferred: [], roles, unsupportedRoles: [], recommendations: [], roadmap: null, graph: { nodes: [], edges: [], totalSkills: 0 }, counts: { verified: 0, claimed: 0, inferred: 0, assessed: 0 }, ...extra }) as IntelligenceDoc;

  it("never shows a score for a pre-v3 assessment", () => {
    expect(standingView(doc([role([row("A")])], { engineVersion: 2 }), "ml_engineer").state).toBe("legacy");
  });

  it("is neutral when no direction is selected, and says so when the direction has no framework", () => {
    expect(standingView(doc([role([row("A")])]), null).state).toBe("no_direction");
    expect(standingView(doc([], { unsupportedRoles: ["chef"] }), "chef")).toMatchObject({ state: "unsupported", roles: ["chef"] });
    expect(standingView(undefined, "ml_engineer").state).toBe("pending");
  });

  it("lists up to three required gaps, the engine's critical ones first, never supporting skills", () => {
    const r = role([none("A"), row("B", { proficiency: 20, state: "underdeveloped", gapType: "insufficient_proficiency" }), none("C", { tier: "supporting" }), none("D"), none("E")], {});
    r.alignment!.criticalGaps = ["D", "A"];
    expect(priorityGaps(r).map((g) => g.skill)).toEqual(["D", "A", "B"]);
    expect(priorityGaps(r)[2].note).toBe("Shown, below the expected level");
  });

  it("never calls a suggested or listed skill missing, nor a suggested one self-described", () => {
    expect(gapNote(none("ML", { state: "inferred", gapType: "insufficient_evidence" }))).toBe("Only suggested by related skills");
    expect(gapNote(none("A", { state: "unverified", gapType: "claimed_unverified" }))).toBe("Listed, not yet shown in your work");
    expect(gapNote(row("B", { state: "unverified", evidenceState: "unverified", gapType: "insufficient_evidence" }))).toBe("Shown only in your own descriptions");
    expect(gapNote(none("C"))).toBe("No evidence yet");
  });

  it("labels a draft framework as a draft", () => {
    const v = standingView(doc([role([row("A")], { framework: { version: "1", status: "draft", responsibilities: [], completionCriteria: "" } })]), "ml_engineer");
    expect(v.state === "ready" && v.draft).toBe(true);
  });
});
