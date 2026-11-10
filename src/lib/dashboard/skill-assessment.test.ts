import { describe, expect, it } from "vitest";

import type { EngineSkill } from "@/lib/dashboard/types";

import { assessedLevel, confidenceOf, evidenceSources, evidenceStateOf, groupSkills } from "./skill-assessment";

const ev = (kind: string, label = kind) => ({ kind, source: "x", label, ref: null, at: null });
const skill = (name: string, extra: Partial<EngineSkill> = {}): EngineSkill => ({
  name,
  category: "language",
  status: "claimed",
  proficiency: null,
  level: "Not assessed",
  confidence: 0.3,
  evidenceCount: 1,
  evidence: [ev("claim")],
  lastEvidenceAt: null,
  ...extra,
});

describe("skills page assessment model", () => {
  it("never assigns a level without an engine score", () => {
    expect(assessedLevel(skill("Go", { level: "Foundational", proficiency: null }))).toBe("Not assessed");
    expect(assessedLevel(skill("Go", { level: "Advanced", proficiency: 78 }))).toBe("Advanced");
  });

  it("uses the engine's evidence state and never strengthens a legacy status", () => {
    expect(evidenceStateOf(skill("A", { status: "verified", evidenceState: "unverified" }))).toBe("unverified");
    expect(evidenceStateOf(skill("A", { status: "verified" }))).toBe("demonstrated");
    expect(evidenceStateOf(skill("A", { status: "claimed" }))).toBe("claimed");
    expect(evidenceStateOf(skill("A", { status: "inferred" }))).toBe("inferred");
    expect(evidenceStateOf(skill("A", { evidenceState: "missing" }))).toBe("none");
  });

  it("puts every skill in exactly one group, assessed first by score, suggestions never assessed", () => {
    const skills = [skill("Low", { proficiency: 30, status: "verified" }), skill("High", { proficiency: 80, status: "verified" }), skill("Listed"), skill("Odd", { status: "inferred", proficiency: 50 })];
    const inferred = [skill("Kubernetes", { status: "inferred", evidence: [], evidenceCount: 0, inferredFrom: ["Docker"] })];
    const g = groupSkills(skills, inferred);
    expect(g.assessed.map((s) => s.name)).toEqual(["High", "Low"]);
    expect(g.claimed.map((s) => s.name)).toEqual(["Listed"]);
    expect(g.suggested.map((s) => s.name)).toEqual(["Kubernetes", "Odd"]);
    expect(g.assessed.length + g.claimed.length + g.suggested.length).toBe(skills.length + inferred.length);
  });

  it("counts real evidence by kind, self-reported last", () => {
    expect(evidenceSources(skill("P", { evidence: [ev("claim"), ev("repository"), ev("repository"), ev("project")] }))).toEqual([
      { kind: "repository", label: "GitHub repositories", count: 2 },
      { kind: "project", label: "Projects", count: 1 },
      { kind: "claim", label: "Self-reported", count: 1 },
    ]);
    expect(evidenceSources(skill("P", { evidence: [] }))).toEqual([]);
  });

  it("describes confidence only when there is an assessment", () => {
    expect(confidenceOf(skill("A", { proficiency: null, confidence: 0.9 }))).toBeNull();
    expect(confidenceOf(skill("A", { proficiency: 60, confidence: 0.85 }))).toBe("High");
  });
});
