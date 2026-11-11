import { describe, expect, it } from "vitest";

import { currentLevelText, expectsText, needsShort, prerequisiteText, stateText } from "./plain-language";

describe("student-facing skill wording", () => {
  it("keeps listed, described, suggested, missing and unassessed apart", () => {
    const labels = new Set([
      stateText({ state: "unverified", proficiency: null }).label,
      stateText({ state: "unverified", proficiency: 40 }).label,
      stateText({ state: "inferred", proficiency: null }).label,
      stateText({ state: "missing", proficiency: null }).label,
      stateText({ state: "not_assessed", proficiency: null }).label,
      stateText({ state: "underdeveloped", proficiency: 20 }).label,
      stateText({ state: "met", proficiency: 60 }).label,
    ]);
    expect(labels.size).toBe(7);
  });

  it("never describes missing evidence as missing ability", () => {
    for (const state of ["unverified", "inferred", "missing", "not_assessed"] as const) {
      const t = stateText({ state, proficiency: null });
      expect(`${t.label} ${t.sentence}`).not.toMatch(/\b(lack|can't|cannot|unable|weak|fail)/i);
    }
    expect(stateText({ state: "missing", proficiency: null }).sentence).toMatch(/haven't found examples of your work/);
  });

  it("explains levels instead of naming them", () => {
    expect(expectsText("ML Engineer", "Proficient")).toBe("ML Engineer expects you to use this skill independently (Proficient).");
    expect(needsShort("Working")).toBe("Needed: do practical tasks with some guidance");
    // Short enough for one line in a narrow card.
    for (const level of ["Foundational", "Working", "Proficient", "Advanced"]) expect(needsShort(level).length).toBeLessThanOrEqual(48);
    expect(expectsText("X", "Expert")).toBe("X expects Expert level.");
  });

  it("states the real prerequisite rather than 'unlock'", () => {
    expect(prerequisiteText(["Statistics"])).toBe("Start this after your work shows Statistics at the level this role expects, because it builds on it.");
    expect(prerequisiteText(["A", "B"])).toMatch(/A and B .* builds on them\.$/);
    expect(prerequisiteText(["A"])).not.toMatch(/unlock/i);
  });

  it("says 'not assessed' instead of showing a level for an unscored skill", () => {
    expect(currentLevelText({ proficiency: null, level: "Foundational" })).toBe("Not assessed yet");
    expect(currentLevelText({ proficiency: 30, level: "Working" })).toBe("Assessed at Working");
  });
});
