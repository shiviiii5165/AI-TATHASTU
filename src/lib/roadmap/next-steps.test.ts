import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { IntelligenceDoc } from "@/lib/dashboard/types";

import { nextStepsFromRoadmap } from "./next-steps";

const engine: IntelligenceDoc = JSON.parse(readFileSync(path.join(__dirname, "../../../e2e/fixtures/engine-profile.json"), "utf8")).intelligence;

describe("next steps from the roadmap", () => {
  it("lists only milestones that can be worked on now, the engine's next one first", () => {
    const { steps, empty } = nextStepsFromRoadmap(engine);
    expect(empty).toBeNull();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps.length).toBeLessThanOrEqual(3);
    expect(steps[0].title.startsWith("Statistics:")).toBe(true); // the engine's active milestone
    // Machine Learning waits on Statistics and MLflow on Machine Learning: never offered as a next step.
    for (const s of steps) expect(s.title).not.toMatch(/^(Machine Learning|MLflow):/);
    // Every step is a skill from the roadmap for the chosen goal.
    const skills = engine.roadmap!.stages.flatMap((st) => st.milestones.map((m) => m.skill));
    for (const s of steps) expect(skills).toContain(s.title.split(":")[0]);
  });

  it("links a catalogue course only where the engine recommended one, otherwise the roadmap", () => {
    const { steps } = nextStepsFromRoadmap(engine);
    const stats = steps.find((s) => s.title.startsWith("Statistics:"))!;
    expect(stats.btnHref).toBe(engine.recommendations.find((r) => r.skill === "Statistics")!.resource!.url);
    const docker = nextStepsFromRoadmap(engine, [], 9).steps.find((s) => s.title.startsWith("Docker:"))!;
    expect(docker.btnHref).toBe("#career-roadmap");
  });

  it("explains why each step is there from the goal's expectation and the evidence", () => {
    for (const s of nextStepsFromRoadmap(engine).steps) expect(s.desc).toMatch(/^ML Engineer expects .+ at .+; /);
  });

  it("can leave out the engine's next milestone when the roadmap already shows it as the next action", () => {
    const steps = nextStepsFromRoadmap(engine, [], 3, { excludeNext: true }).steps;
    expect(steps.some((s) => s.title.startsWith("Statistics:"))).toBe(false);
    expect(steps.length).toBeGreaterThan(0);
  });

  it("drops a milestone with evidence pending review", () => {
    const steps = nextStepsFromRoadmap(engine, [{ milestoneId: "ml_engineer:statistics", evidenceUrl: "https://x.dev", createdAt: new Date(Date.parse(engine.computedAt) + 60_000) }]).steps;
    expect(steps.some((s) => s.title.startsWith("Statistics:"))).toBe(false);
  });

  it("says what's missing instead of inventing steps", () => {
    expect(nextStepsFromRoadmap(undefined)).toMatchObject({ steps: [], empty: { message: expect.stringMatching(/processed/) } });
    expect(nextStepsFromRoadmap({ ...engine, roadmap: null, unsupportedRoles: [] })).toMatchObject({ steps: [], empty: { message: expect.stringMatching(/career goal/) } });
    // No link to a page that can't change the goal.
    expect(nextStepsFromRoadmap({ ...engine, roadmap: null, unsupportedRoles: [] }).empty?.href).toBeUndefined();
    expect(nextStepsFromRoadmap({ ...engine, roadmap: null, unsupportedRoles: ["astronaut"] })).toMatchObject({ steps: [], empty: { message: expect.stringMatching(/competency framework/) } });
    const done = { ...engine, roadmap: { ...engine.roadmap!, stages: [] } };
    expect(nextStepsFromRoadmap(done).empty?.message).toMatch(/Every skill ML Engineer needs/);
  });
});
