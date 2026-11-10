import { describe, expect, it } from "vitest";

import type { SkillGraphData, SkillGraphNode } from "@/lib/dashboard/types";

import { clusterOf, confidenceLabel, evidenceMix, groupEvidence, skillClusters, visibleEdges, whyIdentified } from "./skill-intel";

const ev = (kind: string, label = kind) => ({ kind, source: "github", label, ref: null, at: null });
const node = (id: string, category: string, status: SkillGraphNode["status"], evidence = [ev("repository")], extra: Partial<SkillGraphNode> = {}): SkillGraphNode => ({
  id,
  name: id,
  category,
  status,
  level: status === "inferred" ? "Not assessed" : "Working",
  proficiency: status === "inferred" ? null : 40,
  confidence: 0.6,
  evidenceCount: evidence.length,
  evidence,
  inferredFrom: [],
  ...extra,
});

describe("skills intelligence view model", () => {
  it("groups by the engine's catalogue category and keeps suggestions apart", () => {
    expect(clusterOf(node("Python", "language", "verified"))).toBe("languages");
    expect(clusterOf(node("PostgreSQL", "database", "claimed"))).toBe("data");
    expect(clusterOf(node("Weird", "nonsense", "verified"))).toBe("other");
    expect(clusterOf(node("Docker", "mlops", "inferred", []))).toBe("suggested");
    const clusters = skillClusters([node("X", "other", "inferred", []), node("Python", "language", "verified"), node("Go", "language", "verified"), node("SQL", "database", "verified")]);
    expect(clusters.map((c) => c.key)).toEqual(["languages", "data", "suggested"]);
  });

  it("draws only edges whose ends are both on screen", () => {
    const graph: SkillGraphData = {
      nodes: [],
      totalSkills: 0,
      edges: [
        { source: "a", target: "b", relationship: "used_together", basis: "evidence", evidence: ["repo"], weight: 1 },
        { source: "a", target: "ghost", relationship: "requires", basis: "ontology", evidence: [], weight: 0.5 },
        { source: "a", target: "a", relationship: "relates_to", basis: "ontology", evidence: [], weight: 0.5 },
      ],
    };
    expect(visibleEdges(graph, new Set(["a", "b"]))).toHaveLength(1);
    expect(visibleEdges(undefined, new Set(["a"]))).toEqual([]);
  });

  it("counts recorded evidence by kind, without adding any", () => {
    const mix = evidenceMix([node("a", "language", "verified", [ev("repository"), ev("project")]), node("b", "language", "verified", [ev("repository")])]);
    expect(mix).toEqual([
      { kind: "repository", count: 2 },
      { kind: "project", count: 1 },
    ]);
    expect(evidenceMix([])).toEqual([]);
    expect(groupEvidence([ev("project", "A"), ev("repository", "B"), ev("project", "C")]).map((g) => [g.kind, g.items.length])).toEqual([
      ["project", 2],
      ["repository", 1],
    ]);
  });

  it("explains each status from what was actually recorded", () => {
    expect(whyIdentified(node("Python", "language", "verified", [ev("repository"), ev("claim")]))).toMatch(/Verified from your github repositories/);
    expect(whyIdentified(node("Rust", "language", "claimed", [ev("claim")], { proficiency: null }))).toMatch(/isn't scored/);
    expect(whyIdentified(node("Rust", "language", "claimed", [ev("project")], { proficiency: 30 }))).toMatch(/capped/);
    expect(whyIdentified(node("MLflow", "other", "inferred", [], { inferredFrom: ["PyTorch", "Docker"] }))).toMatch(/PyTorch and Docker/);
  });

  it("words confidence from the engine's own thresholds", () => {
    expect([0.35, 0.6, 0.8, 0.9].map(confidenceLabel)).toEqual(["Low", "Medium", "High", "High"]);
  });
});
