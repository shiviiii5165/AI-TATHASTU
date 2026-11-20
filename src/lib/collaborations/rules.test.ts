import { describe, expect, it } from "vitest";

import { publicPost } from "./public";
import { canRenew, creatorTypeFor, lifecycleStep, nextStatus } from "./rules";
import { applicationInput, contentHash, looksLikeSpam, postInput, publishProblems, safeUrl } from "./validation";

const DAY = 86_400_000;
const at = (daysAgo: number) => new Date(Date.now() - daysAgo * DAY);

describe("status transitions", () => {
  it("follows the lifecycle and refuses the rest", () => {
    expect(nextStatus("draft", "publish", 0, 3)).toBe("recruiting");
    expect(nextStatus("recruiting", "pause", 0, 3)).toBe("paused");
    expect(nextStatus("paused", "resume", 1, 3)).toBe("recruiting");
    expect(nextStatus("paused", "resume", 3, 3)).toBe("team_full"); // full is not completed
    expect(nextStatus("team_full", "start", 3, 3)).toBe("in_progress");
    expect(nextStatus("in_progress", "complete", 3, 3)).toBe("completed");
    expect(nextStatus("expired", "renew", 0, 3)).toBe("recruiting");
    expect(nextStatus("recruiting", "renew", 0, 3)).toBe("recruiting");
    expect(nextStatus("draft", "complete", 0, 3)).toBeNull();
    expect(nextStatus("completed", "publish", 0, 3)).toBeNull();
    expect(nextStatus("suspended", "resume", 0, 3)).toBeNull();
    expect(nextStatus("suspended", "reopen", 0, 3)).toBeNull();
    expect(nextStatus("recruiting", "complete", 0, 3)).toBeNull();
  });
});

describe("creator type", () => {
  it("never trusts the persona for faculty or alumni", () => {
    expect(creatorTypeFor({ isOperator: false, verification: null, persona: "faculty" })).toBe("community");
    expect(creatorTypeFor({ isOperator: false, verification: null, persona: "student" })).toBe("student");
    expect(creatorTypeFor({ isOperator: false, verification: "alumni", persona: "student" })).toBe("alumni");
    expect(creatorTypeFor({ isOperator: true, verification: null, persona: "student" })).toBe("admin");
  });
});

describe("60-day inactivity", () => {
  const post = (daysAgo: number, reminderStage = 0, status = "recruiting" as const) => ({ status, renewedAt: null, publishedAt: at(daysAgo), createdAt: at(daysAgo), reminderStage });
  it("reminds on day 45 and 55 once, expires on day 60", () => {
    expect(lifecycleStep(post(44), new Date())).toBeNull();
    expect(lifecycleStep(post(45), new Date())).toMatchObject({ kind: "remind", stage: 1, daysLeft: 15 });
    expect(lifecycleStep(post(50, 1), new Date())).toBeNull();
    expect(lifecycleStep(post(55, 1), new Date())).toMatchObject({ kind: "remind", stage: 2, daysLeft: 5 });
    expect(lifecycleStep(post(56, 2), new Date())).toBeNull();
    expect(lifecycleStep(post(60, 2), new Date())).toEqual({ kind: "expire" });
  });
  it("counts from the last renewal, and leaves teams that are working alone", () => {
    expect(lifecycleStep({ status: "recruiting", renewedAt: at(1), publishedAt: at(90), createdAt: at(90), reminderStage: 0 }, new Date())).toBeNull();
    expect(lifecycleStep({ status: "in_progress", renewedAt: null, publishedAt: at(90), createdAt: at(90), reminderStage: 0 }, new Date())).toBeNull();
  });
  it("renews only while the deadline hasn't passed", () => {
    expect(canRenew({ status: "expired", deadline: null }, "2026-11-20")).toBe(true);
    expect(canRenew({ status: "expired", deadline: "2026-11-19" }, "2026-11-20")).toBe(false);
    expect(canRenew({ status: "suspended", deadline: null }, "2026-11-20")).toBe(false);
  });
});

describe("validation", () => {
  const valid = { category: "learning_group", title: "DSA study circle", summary: "Weekly problems.", roles: [{ title: "Member", count: 5 }], details: { topic: "Graphs" } };
  it("accepts a minimal learning group and derives capacity", () => {
    const r = postInput.safeParse(valid);
    expect(r.success && r.data.capacity).toBe(5);
  });
  it("needs a location for in-person teams and a deadline before the start", () => {
    const r = postInput.safeParse({ ...valid, mode: "in_person", startDate: "2027-01-01", deadline: "2027-02-01" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["location", "deadline"]));
  });
  it("caps teams at 50 and strips control characters", () => {
    expect(postInput.safeParse({ ...valid, roles: [{ title: "A", count: 20 }, { title: "B", count: 20 }, { title: "C", count: 20 }] }).success).toBe(false);
    const r = postInput.safeParse({ ...valid, title: "DSA\u0000 study circle" });
    expect(r.success && r.data.title).toBe("DSA study circle");
  });
  it("keeps markup as inert text (React escapes it on output)", () => {
    const r = postInput.safeParse({ ...valid, summary: "<img src=x onerror=alert(1)>" });
    expect(r.success && r.data.summary).toBe("<img src=x onerror=alert(1)>");
  });
  it("only allows http(s) links without credentials", () => {
    expect(safeUrl.safeParse("https://github.com/x").success).toBe(true);
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "//evil.com", "https://user:pw@x.com", "ftp://x.com"]) expect(safeUrl.safeParse(bad).success).toBe(false);
  });
  it("applications need an introduction and motivation", () => {
    expect(applicationInput.safeParse({ intro: " ", motivation: "x" }).success).toBe(false);
    expect(applicationInput.safeParse({ intro: "hi", motivation: "x", links: ["https://a.dev"] }).success).toBe(true);
  });
  it("detects duplicates, spam and past deadlines", () => {
    expect(contentHash({ title: "Food  Waste!", summary: "x" })).toBe(contentHash({ title: "food waste", summary: "X" }));
    expect(looksLikeSpam("buy ".repeat(3) + "a".repeat(30))).toBe(true);
    expect(looksLikeSpam("A normal description of a robotics club project.")).toBe(false);
    expect(publishProblems({ deadline: "2020-01-01" }, "2026-11-20")).toHaveProperty("deadline");
  });
});

describe("public projection", () => {
  it("exposes only allow-listed fields", () => {
    const row = {
      id: "p1", ownerId: "secret-owner-id", creatorType: "student", category: "project", status: "recruiting", statusBeforeSuspension: null,
      title: "T", summary: "S", problem: "", objectives: "", outcome: "", stage: "idea", roles: [], skills: [], capacity: 2, experience: "", commitment: "",
      duration: "", mode: "remote", location: null, startDate: null, deadline: null, links: [], details: {}, contentHash: "secret-hash", search: "x",
      publishedAt: new Date(), renewedAt: null, reminderStage: 0, expiredAt: null, ownerActiveAt: new Date(), needsOwnerReview: true, ownerReviewReason: "owner_inactive",
      createdAt: new Date(), updatedAt: new Date(),
    } as const;
    const out = JSON.stringify(publicPost(row as never, 1, "Asha"));
    for (const secret of ["secret-owner-id", "secret-hash", "owner_inactive", "needsOwnerReview", "ownerActiveAt"]) expect(out).not.toContain(secret);
    expect(JSON.parse(out)).toMatchObject({ members: 1, openPositions: 1, creator: { name: "Asha", label: "Student-led", verified: false } });
  });
});
