import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { IntelligenceDoc } from "@/lib/dashboard/types";

import { roadmapView } from "./view";

const engine: IntelligenceDoc = JSON.parse(readFileSync(path.join(__dirname, "../../../e2e/fixtures/engine-profile.json"), "utf8")).intelligence;
const ready = (doc: IntelligenceDoc | undefined, subs = []) => {
  const v = roadmapView(doc, subs);
  if (v.state !== "ready") throw new Error(`expected a roadmap, got ${v.state}`);
  return v;
};

describe("career roadmap view", () => {
  it("shows the user's own goal and position, with the goal's catalogue description", () => {
    const v = ready(engine);
    expect(v.goal).toEqual({ id: "ml_engineer", label: "ML Engineer", blurb: expect.stringMatching(/machine learning models/) });
    expect(v.position).toBe(engine.roadmap!.currentPosition);
    // Another goal: nothing about ML Engineer leaks in.
    const other = ready({ ...engine, roadmap: { ...engine.roadmap!, role: "data_scientist" } });
    expect(other.goal.label).toBe("Data Scientist");
    expect(other.goal.blurb).not.toMatch(/machine learning models into products/);
  });

  it("takes coverage from the engine and never inflates it", () => {
    const v = ready(engine);
    expect(v.coverage.percent).toBe(Math.round(engine.roadmap!.progress * 100));
    expect(v.coverage.met).toBe(engine.roadmap!.completed.length);
    expect(v.coverage.total).toBe(engine.roles[0].skills.length);
  });

  it("shows no percentage when the engine couldn't assess the goal (unavailable, not zero)", () => {
    const unassessed = { ...engine, roles: engine.roles.map((r) => ({ ...r, assessed: false })) };
    expect(ready(unassessed).coverage.percent).toBeNull();
  });

  it("classifies the goal's skills from the engine's states; a claim alone is never demonstrated", () => {
    const v = ready(engine);
    const bucket = (k: string) => v.skills.find((b) => b.key === k)!.rows.map((r) => r.skill);
    const state = (skill: string) => engine.roles[0].skills.find((r) => r.skill === skill)!.state;
    for (const s of bucket("demonstrated")) expect(state(s)).toBe("met");
    for (const s of bucket("inProgress")) expect(state(s)).toBe("underdeveloped");
    for (const s of bucket("notYet")) expect(["unverified", "inferred", "missing", "not_assessed"]).toContain(state(s));
    expect(bucket("demonstrated").length + bucket("inProgress").length + bucket("notYet").length).toBe(engine.roles[0].skills.length);
    const claimedOnly = { ...engine, roles: engine.roles.map((r) => ({ ...r, skills: r.skills.map((s) => ({ ...s, state: "unverified" as const })) })) };
    expect(ready(claimedOnly).skills.find((b) => b.key === "demonstrated")!.rows).toHaveLength(0);
  });

  it("maps the engine's stages in order, marks the active one and explains a blocked one", () => {
    const v = ready(engine);
    expect(v.stages.map((s) => s.key)).toEqual(engine.roadmap!.stages.map((s) => s.key));
    expect(v.stages.map((s) => s.horizon)).toEqual(["Short term", "Mid term", "Long term"].slice(0, v.stages.length));
    expect(v.nextStage?.key).toBe("foundation");
    const blocked = v.stages.find((s) => s.status === "blocked");
    expect(blocked).toBeDefined();
    expect(blocked!.blockedBy.length).toBeGreaterThan(0);
  });

  it("follows the engine's structure rather than forcing three stages", () => {
    const one = ready({ ...engine, roadmap: { ...engine.roadmap!, stages: engine.roadmap!.stages.slice(0, 1) } });
    expect(one.stages).toHaveLength(1);
  });

  it("shows a timeline only where the engine gave an estimate", () => {
    expect(ready(engine).stages.every((s) => s.estimateWeeks === engine.roadmap!.stages.find((x) => x.key === s.key)!.estimateWeeks)).toBe(true);
    const none = ready({ ...engine, roadmap: { ...engine.roadmap!, stages: engine.roadmap!.stages.map((s) => ({ ...s, estimateWeeks: 0 })) } });
    expect(none.stages.every((s) => s.estimateWeeks === null)).toBe(true);
  });

  it("takes the next action from the engine's next milestone, with its reason and course", () => {
    const v = ready(engine);
    expect(v.nextAction?.step.skill).toBe("Statistics");
    expect(v.nextAction?.reason).toMatch(/ML Engineer expects Statistics/);
    expect(v.nextAction?.rec?.resource?.url).toBe(engine.recommendations.find((r) => r.skill === "Statistics")!.resource!.url);
    expect(v.nextAction?.horizon).toBe("Short term");
  });

  it("says what's missing instead of drawing a plan", () => {
    expect(roadmapView(undefined)).toEqual({ state: "pending" });
    expect(roadmapView({ ...engine, roadmap: null, unsupportedRoles: [] })).toEqual({ state: "no_goal" });
    expect(roadmapView({ ...engine, roadmap: null, unsupportedRoles: ["astronaut"] })).toMatchObject({ state: "unsupported" });
  });
});
