import { describe, expect, it } from "vitest";

import { codingActivitiesFrom, isCodingActivityRecord } from "./coding-activity";

const leetcode = [
  { fieldName: "title", recordKey: "leetcode:stats", normalizedValue: "LeetCode: 4 problems solved (Easy 1 · Medium 2 · Hard 1)", extractedValue: { easy: 1, medium: 2, hard: 1, total: 4 }, sourceEvidence: "leetcode.com/u/alice" },
];
const honour = [{ fieldName: "title", recordKey: "ach-1", normalizedValue: "Best Paper Award", extractedValue: "Best Paper Award" }];

describe("coding activity classification", () => {
  it("routes LeetCode/HackerRank records away from honours", () => {
    expect(isCodingActivityRecord("leetcode:stats")).toBe(true);
    expect(isCodingActivityRecord("hackerrank:stats")).toBe(true);
    expect(isCodingActivityRecord("ach-1")).toBe(false);
    expect(isCodingActivityRecord(null)).toBe(false);
    // leetcode-lang / leetcode-dsa are skill facts, not activity records
    expect(isCodingActivityRecord("leetcode-dsa")).toBe(false);
  });

  it("keeps the exact Easy/Medium/Hard breakdown and source, never reclassified as an award", () => {
    const [a, ...rest] = codingActivitiesFrom([...leetcode, ...honour]);
    expect(rest).toHaveLength(0);
    expect(a).toMatchObject({ source: "leetcode", sourceLabel: "LeetCode", total: 4, easy: 1, medium: 2, hard: 1, profileRef: "leetcode.com/u/alice", verification: "public_profile_import" });
  });

  it("leaves counts the platform did not return as unknown, not zero", () => {
    const [a] = codingActivitiesFrom([{ fieldName: "title", recordKey: "leetcode:stats", normalizedValue: "LeetCode", extractedValue: { easy: 3, total: null } }]);
    expect(a.easy).toBe(3);
    expect(a.total).toBeNull();
    expect(a.hard).toBeNull();
  });
});
