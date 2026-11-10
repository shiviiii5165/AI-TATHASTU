import { describe, expect, it } from "vitest";

import { relevanceReason, summarySkills } from "./people-preview";

const summary = (skills: string[], projects: string[] = ["Secret Project"]) => `student at IIT Delhi. Skills: ${skills.join(", ")}. Projects: ${projects.join(", ")}.`;

describe("people preview reasons", () => {
  it("reads only the skills from a collaboration summary, never the projects", () => {
    expect(summarySkills(summary(["Python", "Next.js", "SQL"]))).toEqual(["Python", "Next.js", "SQL"]);
    expect(summarySkills(summary(["Python"], ["Resume Parser"]))).not.toContain("Resume Parser");
    expect(summarySkills("student at X. Skills: . Projects: .")).toEqual([]);
    expect(summarySkills(null)).toEqual([]);
  });

  it("names skills you genuinely share, up to three, case-insensitively", () => {
    expect(relevanceReason({ skills: ["python", "SQL", "React"], institution: null }, { skills: ["Python", "SQL", "Go"], institution: null })).toBe("You both work with Python and SQL");
    expect(relevanceReason({ skills: ["A", "B", "C", "D"], institution: null }, { skills: ["A", "B", "C", "D"], institution: null })).toBe("You both work with A, B and C");
  });

  it("falls back to the same university, then to a plain statement, never a percentage", () => {
    expect(relevanceReason({ skills: ["Go"], institution: "IIT Delhi" }, { skills: ["Rust"], institution: "iit delhi" })).toBe("Also at iit delhi");
    const fallback = relevanceReason({ skills: [], institution: null }, { skills: ["Rust"], institution: "MIT" });
    expect(fallback).toBe("Similar skills and goals to yours");
    expect(fallback).not.toMatch(/%/);
  });
});
