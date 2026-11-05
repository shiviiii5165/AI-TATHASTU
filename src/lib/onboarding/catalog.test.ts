import { describe, expect, it } from "vitest";

import { CAREER_ROLES, CAREER_ROLE_IDS, RETIRED_CAREER_ROLES, careerRoleLabel, searchCareerRoles } from "./catalog";

describe("career direction catalog", () => {
  it("offers exactly the 20 canonical AI roles, each with a description", () => {
    expect(CAREER_ROLES).toHaveLength(20);
    expect(new Set(CAREER_ROLES.map((r) => r.id)).size).toBe(20);
    const labels = CAREER_ROLES.map((r) => r.label);
    for (const expected of ["ML Engineer", "Data Scientist", "MLOps Engineer", "LLMOps Engineer", "AI Agent Engineer", "Speech AI Engineer", "Graph AI Engineer", "AI Research Engineer / Applied AI Scientist"]) {
      expect(labels).toContain(expected);
    }
    for (const r of CAREER_ROLES) expect(r.blurb.length).toBeGreaterThan(20);
  });

  it("keeps retired ids valid and labelled so saved preferences are not lost", () => {
    for (const r of RETIRED_CAREER_ROLES) {
      expect(CAREER_ROLE_IDS).toContain(r.id);
      expect(careerRoleLabel(r.id)).toBe(r.label);
    }
    expect(careerRoleLabel("ml_engineer")).toBe("ML Engineer");
  });

  it("searches across labels, descriptions and keywords", () => {
    expect(searchCareerRoles("").length).toBe(20);
    expect(searchCareerRoles("rag").map((r) => r.id)).toContain("llm_application_engineer");
    expect(searchCareerRoles("robot").map((r) => r.id)).toContain("robotics_ai_engineer");
    expect(searchCareerRoles("speech").map((r) => r.id)).toContain("speech_ai_engineer");
    expect(searchCareerRoles("zzzz-nothing")).toHaveLength(0);
  });
});
