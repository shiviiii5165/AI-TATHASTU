import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { IntelligenceDoc } from "@/lib/dashboard/types";

// Server actions pull in the database; the components only need their signatures here.
vi.mock("@/app/(dashboard)/dashboard/roadmap-actions", () => ({ submitRoadmapEvidence: vi.fn() }));
vi.mock("@/app/(dashboard)/dashboard/intent-actions", () => ({ saveProjectIntent: vi.fn() }));

// Written by the real engine (worker/intelligence/career_engine.py, engine v4) for a student with a resume, two
// repositories, a project description, two goals and one unreadable evidence link. Regenerate it with the engine,
// never by hand.
const intel = JSON.parse(readFileSync(path.resolve(__dirname, "__fixtures__/intelligence-v4.json"), "utf8")) as IntelligenceDoc;

const { GrowthDevelopmentRow, SkillGaps } = await import("./mockup-sections/growth-development-row");
const { CareerRoadmap } = await import("./mockup-sections/career-roadmap");
const { ProjectIntentCard } = await import("./mockup-sections/project-intent-card");
const { SkillGapsWidget } = await import("./widgets/skill-gaps-widget");
const { ErisWidget } = await import("./widgets/eris-widget");
const { GapInventory, DataCoveragePanel } = await import("../skills/gap-inventory");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a render helper for components with different props
const render = (el: (props: any) => unknown, props: object) => renderToStaticMarkup(createElement(el as never, props as never));

describe("dashboard intelligence components on an engine v4 document", () => {
  it("Skill Proficiency defaults to the goal's skills, marked against the expected level, with no percentages", () => {
    const html = render(GrowthDevelopmentRow, { intelligence: intel });
    expect(html).toContain("For ML Engineer");
    expect(html).toMatch(/goal: (Working|Proficient)|meets goal/);
    expect(html).not.toMatch(/>\d{1,3}%</);
    expect(html).toContain("required skills meet the level");
  });

  it("Learning Paths explains each resource and never invents a duration", () => {
    const html = render(GrowthDevelopmentRow, { intelligence: intel });
    const withResource = intel.recommendations.find((r) => r.resource);
    expect(withResource).toBeTruthy();
    expect(html).toContain(withResource!.resource!.title.replace(/&/g, "&amp;"));
    expect(html).toContain("with a link we&#x27;ve checked");
    expect(intel.recommendations.every((r) => r.resource === null || r.resource.duration === null)).toBe(true);
  });

  it("Skills to develop follows the inventory order and starts where the roadmap starts", () => {
    const html = render(SkillGapsWidget, { intelligence: intel, primaryRole: "ml_engineer" });
    const first = intel.gapInventory!.find((r) => r.category !== "meets")!;
    expect(html).toContain(first.skill);
    expect(html).toContain("Start here");
    expect(html).toContain("and your project");
    expect(html).toContain("What would show it");
  });

  it("the Skill Gaps goal picker shows a compact second goal's gaps instead of claiming it's met", () => {
    expect(intel.roles[1].compact).toBe(true);
    const html = render(SkillGaps, { intelligence: { ...intel, roles: [intel.roles[1], intel.roles[0]] } });
    expect(html).not.toContain("Your work meets every requirement");
  });

  it("the roadmap shows engine stage purpose, completion criteria, achievements and the submission review", () => {
    const html = render(CareerRoadmap, { intelligence: intel, submissions: [] });
    expect(html).toContain(intel.roadmap!.stages[0].title);
    expect(html).toContain("Nothing here waits on another skill");
    if (intel.roadmap!.achievements?.length) expect(html).toContain("Already shown in your work");
    expect(html).not.toMatch(/\bXP\b|points earned|streak/i);
  });

  it("Where you stand explains why the next action comes first", () => {
    const html = render(ErisWidget, { intelligence: intel, primaryRole: "ml_engineer" });
    expect(html).toContain("ERIS");
    expect(html).toMatch(/First because|data-testid="next-action"/);
  });

  it("the project card shows how the description was read", () => {
    const html = render(ProjectIntentCard, { intelligence: intel });
    expect(html).toContain("What you want to build");
    expect(html).toContain("Retrieval-Augmented Generation");
    expect(html).toContain("Beyond ML Engineer");
  });

  it("the Skills page lists every gap with its evidence and what the result is based on", () => {
    const inv = render(GapInventory, { intelligence: intel });
    for (const r of intel.gapInventory!.filter((r) => r.category !== "meets")) expect(inv).toContain(`data-skill="${r.skill}"`);
    const cov = render(DataCoveragePanel, { coverage: intel.dataCoverage });
    expect(cov).toContain("What this is based on");
    expect(cov).toContain("not source code");
  });
});
