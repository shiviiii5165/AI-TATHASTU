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

  it("takes counts and the alignment state from the engine, and offers no percentage at all", () => {
    const v = ready(engine);
    expect(v.coverage).toEqual({ met: engine.roadmap!.completed.length, total: engine.roles[0].skills.length, assessed: true });
    expect(v.coverage).not.toHaveProperty("percent");
    expect(v.alignment?.state).toBe(engine.roles[0].alignment!.state);
    expect(v.alignment?.label).toBe(engine.roles[0].alignment!.label);
    expect(v.alignment?.explanation).toBeTruthy();
    expect(JSON.stringify(v)).not.toMatch(/\d+%/);
  });

  it("says when the framework is a draft, and when only optional work is left", () => {
    expect(ready(engine).frameworkDraft).toBe(true);
    expect(ready(engine).requirementsMet).toBe(false);
    const done = { ...engine, roadmap: { ...engine.roadmap!, requirementsMet: true } };
    expect(ready(done).requirementsMet).toBe(true);
    expect(ready(engine).stages.find((s) => s.key === "deepen")?.optional).toBe(true);
  });

  it("has no time estimates: engine v3 gives none and the view invents none", () => {
    const v = ready(engine);
    expect(v.stages.every((s) => s.estimateWeeks === null)).toBe(true);
    expect(v.steps.every((s) => s.estimateWeeks === null)).toBe(true);
    expect(v.assumption).toMatch(/No time estimates/);
  });

  it("older documents without an alignment state show none rather than a made-up one", () => {
    const old = { ...engine, roles: engine.roles.map((r) => ({ ...r, alignment: undefined })) };
    expect(ready(old).alignment).toBeNull();
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
    // Prerequisite groups, labelled by order: never "short / mid / long term", which their estimates would contradict.
    expect(v.stages.map((s) => s.horizon)).toEqual(v.stages.map((_, i) => `Stage ${i + 1}`));
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
    expect(v.nextAction?.horizon).toBe("Stage 1");
    // The next action sits in the active stage.
    expect(v.nextAction?.step.stageKey).toBe(v.nextStage?.key);
  });

  it("places the progress marker only as far as completed stages reach", () => {
    expect(ready(engine).reachedIndex).toBe(0); // nothing completed: at where you are
    const plan = engine.roadmap!;
    const withDone = (skills: string[]) => ({ ...engine, roadmap: { ...plan, completed: [...plan.completed, ...skills] } });
    const v1 = ready(withDone(plan.stages[0].milestones.map((m) => m.skill)));
    expect(v1.stages[0].status).toBe("completed");
    expect(v1.reachedIndex).toBe(1); // after Stage 1, not beyond
    // A later stage done while an earlier one isn't: the marker doesn't jump ahead.
    expect(ready(withDone(plan.stages[1].milestones.map((m) => m.skill))).reachedIndex).toBe(0);
    const all = ready(withDone(plan.stages.flatMap((s) => s.milestones.map((m) => m.skill))));
    expect(all.reachedIndex).toBe(plan.stages.length + 1); // at the goal
  });

  it("says what's missing instead of drawing a plan", () => {
    expect(roadmapView(undefined)).toEqual({ state: "pending" });
    expect(roadmapView({ ...engine, roadmap: null, unsupportedRoles: [] })).toEqual({ state: "no_goal" });
    expect(roadmapView({ ...engine, roadmap: null, unsupportedRoles: ["astronaut"] })).toMatchObject({ state: "unsupported" });
  });
});
