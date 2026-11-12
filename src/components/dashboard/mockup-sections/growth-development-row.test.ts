import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { EngineSkill } from "@/lib/dashboard/types";

// The server action pulls in the database; the card only needs its signature here.
vi.mock("@/app/(dashboard)/dashboard/roadmap-actions", () => ({ submitRoadmapEvidence: vi.fn() }));

const { SkillRow, filledSteps, levelWindowText, paletteIndex } = await import("./growth-development-row");

const skill = (name: string, proficiency: number | null, level = "Proficient", extra: Partial<EngineSkill> = {}): EngineSkill =>
  ({ name, proficiency, level, status: "verified", confidence: 0.6, evidenceCount: 2, evidence: [], category: "language", ...extra }) as unknown as EngineSkill;

const count = (html: string, needle: string) => html.split(needle).length - 1;

describe("Skill Proficiency level steps", () => {
  it("fills steps up to the engine's level and never shows a percentage", () => {
    expect(filledSteps(skill("A", 30, "Working"))).toBe(2);
    expect(filledSteps(skill("A", 80, "Advanced"))).toBe(4);
    expect(filledSteps(skill("A", null, "Not assessed"))).toBe(0);
    const html = renderToStaticMarkup(createElement(SkillRow, { skill: skill("TypeScript", 59.4, "Proficient", { levelBasis: ["Code that uses it in 3 repositories"] }), index: 2 }));
    expect(count(html, 'data-testid="skill-step-filled"')).toBe(3);
    expect(html).not.toMatch(/\d+%/);
    expect(html).toContain("Code that uses it in 3 repositories");
    // Animation only scales in from zero (transform), staggered; reduced motion shows the end state.
    expect(html).toContain("skillBarGrow");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("marks the level the goal expects and says when it's met", () => {
    const below = renderToStaticMarkup(createElement(SkillRow, { skill: skill("PyTorch", 30, "Working"), index: 0, expectedLevel: "Proficient", met: false }));
    expect(below).toContain("goal: Proficient");
    const met = renderToStaticMarkup(createElement(SkillRow, { skill: skill("Python", 60, "Proficient"), index: 0, expectedLevel: "Proficient", met: true }));
    expect(met).toContain("meets goal");
  });

  it("shows 'Not assessed' with no filled step, and names the kind of evidence", () => {
    const html = renderToStaticMarkup(createElement(SkillRow, { skill: skill("Rust", null, "Not assessed", { status: "claimed", evidenceBasis: "claimed" }), index: 0 }));
    expect(html).toContain("Not assessed");
    expect(html).toContain("Listed only");
    expect(html).not.toContain('data-testid="skill-step-filled"');
  });

  it("describes a resource's level window from the catalogue", () => {
    expect(levelWindowText({ start: "none", reach: "Working" })).toBe("From no experience to Working");
    expect(levelWindowText(undefined)).toBeNull();
  });

  it("gives a skill the same colour every render", () => {
    expect(paletteIndex("Python")).toBe(paletteIndex("python"));
    expect(paletteIndex("Python")).toBe(paletteIndex("Python"));
  });

  it("reduced motion collapses the animation globally to its end state", () => {
    const css = readFileSync(path.resolve(__dirname, "../../../app/globals.css"), "utf8");
    expect(css).toMatch(/@keyframes skillBarGrow/);
    expect(css).toMatch(/prefers-reduced-motion: reduce[\s\S]*animation-duration: 0\.01ms/);
  });
});

describe("dashboard overview row", () => {
  it("no longer renders the Yora Quick Actions panel, while Yora stays wired", () => {
    const src = readFileSync(path.resolve(__dirname, "../dashboard-view.tsx"), "utf8");
    expect(src).not.toMatch(/<QuickActionsPanel/);
    expect(src).toMatch(/<YoraModal/);
    expect(src).toMatch(/onOpenYora/);
  });
});
