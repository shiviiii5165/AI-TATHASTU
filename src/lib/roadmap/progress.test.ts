import { describe, expect, it } from "vitest";

import type { EngineRoadmap } from "@/lib/dashboard/types";

import { milestoneId, roadmapProgress } from "./progress";

const m = (skill: string, done = false, requires: string[] = []) => ({ skill, state: done ? "met" : "missing", done, requires, deliverable: `Build ${skill}`, criterion: `${skill} at level`, estimateWeeks: 4 }) as EngineRoadmap["stages"][number]["milestones"][number];

const roadmap: EngineRoadmap = {
  role: "ml_engineer",
  currentPosition: null,
  progress: 0.3,
  completed: ["Python"],
  stages: [
    { key: "foundation", title: "Build the foundations", estimateWeeks: 8, milestones: [m("Statistics"), m("SQL")] },
    { key: "build", title: "Build on them", estimateWeeks: 4, milestones: [m("Machine Learning", false, ["Statistics"])] },
  ],
  assumption: "",
};
const computedAt = "2026-11-01T00:00:00Z";

describe("career roadmap progress", () => {
  it("uses stable ids compatible with the engine's", () => {
    expect(milestoneId("speech_ai_engineer", "Text-to-Speech")).toBe("speech_ai_engineer:text-to-speech");
    expect(roadmapProgress(roadmap, computedAt).steps.map((s) => s.id)).toEqual(["ml_engineer:statistics", "ml_engineer:sql", "ml_engineer:machine-learning"]);
  });

  it("marks the first open milestone with prerequisites met as active", () => {
    const p = roadmapProgress(roadmap, computedAt);
    expect(p.nextId).toBe("ml_engineer:statistics");
    expect(p.steps.map((s) => s.status)).toEqual(["active", "upcoming", "upcoming"]);
  });

  it("never completes a milestone or moves progress on a user's submission alone", () => {
    const p = roadmapProgress(roadmap, computedAt, [{ milestoneId: "ml_engineer:statistics", evidenceUrl: "https://github.com/a/b", createdAt: "2026-11-02T00:00:00Z" }]);
    expect(p.steps[0].status).toBe("submitted");
    expect(p.progress).toBe(0.3);
    expect(p.completed).toEqual(["Python"]);
  });

  it("asks for more evidence once the engine has run after the submission without finding the skill", () => {
    const p = roadmapProgress(roadmap, computedAt, [{ milestoneId: "ml_engineer:statistics", evidenceUrl: "https://x.dev", createdAt: "2026-10-30T00:00:00Z" }]);
    expect(p.steps[0].status).toBe("needs_more_evidence");
  });

  it("completes only from engine evidence, then highlights the next milestone", () => {
    const validated: EngineRoadmap = { ...roadmap, progress: 0.5, completed: ["Python", "Statistics"], stages: [{ ...roadmap.stages[0], milestones: [m("Statistics", true), m("SQL")] }, roadmap.stages[1]] };
    const p = roadmapProgress(validated, computedAt);
    expect(p.steps[0].status).toBe("completed");
    expect(p.nextId).toBe("ml_engineer:sql");
    expect(p.progress).toBe(0.5);
  });

  it("clamps progress to the engine's 0-1 range and never invents it", () => {
    expect(roadmapProgress({ ...roadmap, progress: 1.7 }, computedAt).progress).toBe(1);
    expect(roadmapProgress({ ...roadmap, progress: 0 }, computedAt).progress).toBe(0);
  });
});
