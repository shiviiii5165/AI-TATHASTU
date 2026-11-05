import { describe, expect, it } from "vitest";

import type { SkillGraphData, SkillGraphNode } from "@/lib/dashboard/types";

import { relatedSkills, topSkills } from "./skills-overview";

const node = (id: string, status: SkillGraphNode["status"], proficiency: number | null, evidenceCount = 0): SkillGraphNode =>
  ({ id, name: id.toUpperCase(), category: "x", status, level: "Intermediate", proficiency, confidence: 0.5, evidenceCount, evidence: [], inferredFrom: [] }) as unknown as SkillGraphNode;

const graph: SkillGraphData = {
  nodes: [node("c", "inferred", null), node("a", "verified", 40), node("b", "verified", 80), node("d", "claimed", null, 2)],
  edges: [
    { source: "b", target: "a", relationship: "related", basis: "ontology", evidence: [], weight: 0.2 },
    { source: "b", target: "d", relationship: "used_with", basis: "evidence", evidence: [], weight: 0.1 },
    { source: "b", target: "ghost", relationship: "related", basis: "ontology", evidence: [], weight: 0.9 },
  ] as unknown as SkillGraphData["edges"],
  totalSkills: 4,
};

describe("dashboard skills overview", () => {
  it("is compact: verified first, then claimed, then suggested, limited in count", () => {
    expect(topSkills(graph).map((n) => n.id)).toEqual(["b", "a", "d", "c"]);
    expect(topSkills(graph, 2)).toHaveLength(2);
    expect(topSkills(undefined)).toEqual([]);
  });

  it("lists related skills from real edges, evidence-backed first", () => {
    const rel = relatedSkills(graph, "b");
    expect(rel[0].id).toBe("d");
    expect(rel.find((r) => r.id === "ghost")?.inGraph).toBe(false);
    expect(relatedSkills(graph, "c")).toEqual([]);
  });
});
