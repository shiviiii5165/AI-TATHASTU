import { describe, expect, it } from "vitest";

import type { RoleSkillRow } from "@/lib/dashboard/types";

import { SEGMENT_MS, journeyDelays } from "./journey-timeline";
import { milestoneReason } from "@/lib/roadmap/explain";

const row = (state: RoleSkillRow["state"], proficiency: number | null = null): RoleSkillRow => ({
  skill: "SQL",
  weight: 1,
  priority: "High",
  expected: 50,
  expectedLevel: "Proficient",
  proficiency,
  level: proficiency === null ? "Not assessed" : "Working",
  confidence: 0.5,
  state,
  insufficientEvidence: false,
  action: null,
  evidence: [],
});

describe("career roadmap reasons", () => {
  it("explains a gap from the role's expectation and the user's evidence", () => {
    expect(milestoneReason("ML Engineer", row("underdeveloped", 30), { skill: "SQL", status: "active" })).toBe(
      "ML Engineer expects SQL at Proficient (high priority). Right now your evidence shows it, but below that level (Working).",
    );
    expect(milestoneReason("ML Engineer", row("missing"), { skill: "SQL", status: "blocked" })).toMatch(/nothing on your profile shows it yet\.$/);
  });

  it("never claims a gap for a completed milestone", () => {
    expect(milestoneReason("ML Engineer", row("met", 60), { skill: "SQL", status: "completed" })).toMatch(/shows it at that level/);
  });
});

describe("journey animation order", () => {
  it("reveals each milestone, then the segment leading on, strictly in order", () => {
    const seq = [0, 1, 2].flatMap((i) => [journeyDelays(i).node, journeyDelays(i).segment]);
    expect([...seq].sort((a, b) => a - b)).toEqual(seq);
    for (const i of [0, 1, 4]) expect(journeyDelays(i + 1).node).toBeGreaterThanOrEqual(journeyDelays(i).segment + SEGMENT_MS);
  });
});
