import { readFileSync } from "node:fs";
import path from "node:path";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { EngineSkill } from "@/lib/dashboard/types";

// The server action pulls in the database; the card only needs its signature here.
vi.mock("@/app/(dashboard)/dashboard/roadmap-actions", () => ({ submitRoadmapEvidence: vi.fn() }));

const { SkillRow, barWidth, paletteIndex } = await import("./growth-development-row");

const skill = (name: string, proficiency: number | null, level = "Proficient"): EngineSkill =>
  ({ name, proficiency, level, status: "verified", confidence: 0.6, evidenceCount: 2, evidence: [], category: "language" }) as unknown as EngineSkill;

describe("Skill Proficiency bars", () => {
  it("sizes each bar to the engine's real score, clamped, never padded", () => {
    expect(barWidth(59)).toBe(59);
    expect(barWidth(0)).toBe(0);
    expect(barWidth(140)).toBe(100);
    expect(barWidth(null)).toBeNull();
    expect(barWidth(Number.NaN)).toBeNull();
  });

  it("renders the actual percentage and a fill that ends at it", () => {
    const html = renderToStaticMarkup(createElement(SkillRow, { skill: skill("TypeScript", 59.4), index: 2 }));
    expect(html).toContain("width:59.4%");
    expect(html).toContain(">59%<");
    expect(html).toContain("Proficient");
    // Animation only scales in from zero (transform), with a stagger; the final width is the score.
    expect(html).toContain("skillBarGrow");
    expect(html).toContain("animation-delay:160ms");
    expect(html).toContain("motion-reduce:animate-none");
  });

  it("shows 'Not assessed' with no bar when there is no score", () => {
    const html = renderToStaticMarkup(createElement(SkillRow, { skill: skill("Rust", null, "Not assessed"), index: 0 }));
    expect(html).toContain("Not assessed");
    expect(html).not.toContain("skill-bar-fill");
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
