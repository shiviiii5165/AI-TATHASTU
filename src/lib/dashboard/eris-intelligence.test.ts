import { describe, expect, it } from "vitest";

import type { IntelligenceDoc, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";

import { engineScore, gapNote, intelligenceScore, priorityGaps, standingView } from "./eris-intelligence";

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

describe("ERIS — Intelligence Score is read from the engine, never computed here", () => {
  const engine = { value: 37, version: 1, required: { score: 55, competencies: 4 }, supporting: { score: 17, competencies: 6 }, counts: { evidenced: 4, described: 0, none: 6 } };

  it("shows the engine's own value and breakdown", () => {
    const s = engineScore(role([none("A")], { alignmentScore: engine }));
    expect(s).toMatchObject({ status: "ready", score: { score: 37, required: { score: 55, competencies: 4 }, supporting: { score: 17 }, counts: { none: 6 } } });
  });

  it("doesn't invent a score from the rows, even when they'd give one", () => {
    // Fully met rows but no engine score: still nothing, because only the engine scores.
    expect(engineScore(role([row("Python"), row("SQL")])).status).toBe("pending");
  });

  it("separates 'not calculated yet' from 'not enough evidence', and never turns either into 0", () => {
    expect(engineScore(role([row("A")]))).toEqual({ status: "pending" });
    expect(engineScore(role([row("A")], { alignmentScore: null }))).toEqual({ status: "unavailable" });
    expect(engineScore(role([row("A")], { alignmentScore: { ...engine, value: Number.NaN } }))).toEqual({ status: "unavailable" });
    expect(engineScore(null)).toEqual({ status: "pending" });
    expect(intelligenceScore(role([row("A")], { alignmentScore: null }))).toBeNull();
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
    expect(priorityGaps(r)[2].note).toBe("More practice needed");
  });

  it("never calls a suggested or listed skill missing, nor a suggested one self-described", () => {
    expect(gapNote(none("ML", { state: "inferred", gapType: "insufficient_evidence" }))).toBe("Possibly relevant");
    expect(gapNote(none("A", { state: "unverified", gapType: "claimed_unverified" }))).toBe("Listed, not yet shown");
    expect(gapNote(row("B", { state: "unverified", evidenceState: "unverified", gapType: "insufficient_evidence" }))).toBe("Described, not yet checkable");
    expect(gapNote(none("C"))).toBe("No work examples yet");
  });

  it("labels a draft framework as a draft", () => {
    const v = standingView(doc([role([row("A")], { framework: { version: "1", status: "draft", responsibilities: [], completionCriteria: "" } })]), "ml_engineer");
    expect(v.state === "ready" && v.draft).toBe(true);
  });
});
