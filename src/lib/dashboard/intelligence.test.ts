import { describe, expect, it } from "vitest";

import { categoryOf, evidenceBasisOf, levelStep, openRows, relevanceOf, skillsToDevelop } from "@/lib/dashboard/intelligence";
import { intentSummary } from "@/lib/dashboard/project-intent";
import { stateText } from "@/lib/dashboard/plain-language";
import type { GapInventoryRow, IntelligenceDoc, ProjectAnalysis, RoleAnalysis, RoleSkillRow } from "@/lib/dashboard/types";

const row = (skill: string, state: RoleSkillRow["state"], extra: Partial<RoleSkillRow> = {}): RoleSkillRow =>
  ({ skill, state, tier: "required", weight: 1, priority: "High", expected: 50, expectedLevel: "Proficient", proficiency: null, level: "Not assessed", confidence: 0, insufficientEvidence: false, action: null, evidence: [], ...extra }) as RoleSkillRow;

const analysis = (skills: RoleSkillRow[], extra: Partial<RoleAnalysis> = {}): RoleAnalysis =>
  ({ role: "ml_engineer", coverage: 0, assessed: true, skills, open: skills.filter((s) => s.state !== "met"), counts: {} as RoleAnalysis["counts"], ...extra }) as RoleAnalysis;

const doc = (extra: Partial<IntelligenceDoc>): IntelligenceDoc =>
  ({ engineVersion: 4, computedAt: "2026-11-12T00:00:00Z", hasEvidenceBase: true, skills: [], inferred: [], roles: [], unsupportedRoles: [], recommendations: [], roadmap: null, graph: { nodes: [], edges: [], totalSkills: 0 }, counts: { verified: 0, claimed: 0, inferred: 0, assessed: 0 }, ...extra }) as IntelligenceDoc;

describe("shared intelligence view models", () => {
  it("derives a compact goal's open rows from its skills in priority order", () => {
    const compact = analysis([row("B", "missing", { priorityRank: 2 }), row("A", "met"), row("C", "underdeveloped", { priorityRank: 1 })], { compact: true, open: [] });
    expect(openRows(compact).map((r) => r.skill)).toEqual(["C", "B"]);
  });

  it("uses the engine's complete inventory when it exists, else the primary goal's open rows", () => {
    const inv = [{ ...row("Statistics", "missing"), category: "foundation" }, { ...row("Python", "met"), category: "meets" }] as GapInventoryRow[];
    expect(skillsToDevelop(doc({ gapInventory: inv, roles: [analysis([row("X", "missing")])] })).map((r) => r.skill)).toEqual(["Statistics"]);
    expect(skillsToDevelop(doc({ roles: [analysis([row("X", "missing"), row("Y", "met")])] })).map((r) => r.skill)).toEqual(["X"]);
  });

  it("maps v3 states to v4 categories and words them once for every card", () => {
    expect(categoryOf(row("A", "unverified"))).toBe("proof_needed");
    expect(stateText({ ...row("A", "missing"), category: "foundation" }).label).toBe("Foundation to build first");
    expect(stateText(row("A", "missing")).label).toBe("No work examples yet");
  });

  it("never upgrades older evidence states", () => {
    expect(evidenceBasisOf({ status: "claimed", proficiency: null })).toBe("claimed");
    expect(evidenceBasisOf({ status: "verified", proficiency: 40, evidenceState: "demonstrated" })).toBe("demonstrated");
    expect(levelStep("Working")).toBe(2);
    expect(levelStep("Not assessed")).toBe(0);
  });

  it("says whether a skill matters for the goal or the project", () => {
    const d = doc({ roles: [analysis([row("Python", "met")])], gapInventory: [{ ...row("RAG", "missing"), roleTier: null, projectImportance: "core", sources: ["project"] } as unknown as GapInventoryRow] });
    expect(relevanceOf(d, "Python")?.tone).toBe("required");
    expect(relevanceOf(d, "RAG")?.tone).toBe("project");
    expect(relevanceOf(d, "Rust")).toBeNull();
  });
});

describe("project intent summary", () => {
  const analysed = { status: "analysed", text: "A chatbot over PDFs", source: "profile", rows: [{ ...row("RAG", "missing"), importance: "core", why: "x", triggers: ["pdfs"], careerTier: null }], projectOnly: ["RAG"], careerOnly: ["Statistics"], summary: { core: 1, coreReady: 0, supporting: 0 }, closestRoles: [{ label: "LLM Application Engineer" }], prompts: [] } as unknown as ProjectAnalysis;

  it("shows the engine's reading of the saved text", () => {
    const s = intentSummary(analysed);
    expect(s.state).toBe("analysed");
    if (s.state === "analysed") expect(s.projectOnly).toEqual(["RAG"]);
  });

  it("is pending, not a stale analysis, until the engine has read newly saved text", () => {
    expect(intentSummary(analysed, "A forecasting dashboard").state).toBe("pending");
    expect(intentSummary(analysed, "A chatbot over   PDFs").state).toBe("analysed");
    expect(intentSummary(analysed, "").state).toBe("none");
  });
});
