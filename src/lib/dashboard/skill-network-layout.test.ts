import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { clusterOf } from "./skill-intel";
import { labelLines, layoutSkillNetwork, nodeRadius, outOfBounds, overlaps, shortLabel, type LayoutInput } from "./skill-network-layout";

const NAMES = ["JavaScript", "CSS", "TypeScript", "Python", "HTML", "C", "C++", "PLpgSQL", "Dockerfile", "PowerShell", "Procfile", "Framer Motion", "Next.js", "React", "Retrieval-Augmented Generation", "Kubernetes"];
const input = (n: number): LayoutInput[] =>
  NAMES.slice(0, n).map((name, i) => ({ id: name, name, group: ["languages", "other", "engineering", "ops"][i % 4], evidenceCount: (i * 3) % 11, suggested: i === 15 }));
const ring = (ids: string[]) => ids.slice(1).map((id, i) => ({ source: ids[i], target: id }));

describe("skill network layout", () => {
  for (const width of [300, 360, 560, 760]) {
    it(`places up to 16 skills with no overlapping circles or labels, none clipped, at ${width}px`, () => {
      const nodes = input(16);
      const layout = layoutSkillNetwork(nodes, ring(nodes.map((n) => n.id)), width);
      expect(layout.nodes.size).toBe(16);
      expect(overlaps(layout)).toEqual([]);
      expect(outOfBounds(layout)).toEqual([]);
    });
  }

  it("is deterministic: the same graph gives the same picture", () => {
    const a = layoutSkillNetwork(input(12), [], 600);
    const b = layoutSkillNetwork(input(12), [], 600);
    expect([...a.nodes.values()]).toEqual([...b.nodes.values()]);
  });

  it("sizes circles only from recorded evidence, and never ranks suggestions", () => {
    expect(nodeRadius(0, false)).toBe(nodeRadius(0, true));
    expect(nodeRadius(9, true)).toBe(nodeRadius(0, false));
    expect(nodeRadius(16, false)).toBeGreaterThan(nodeRadius(1, false));
    expect(nodeRadius(100, false)).toBe(nodeRadius(16, false));
  });

  it("keeps labels readable: long names are shortened, short ones untouched", () => {
    expect(shortLabel("Python")).toBe("Python");
    expect(shortLabel("Retrieval-Augmented Generation").length).toBeLessThanOrEqual(20);
    expect(labelLines("Retrieval-Augmented Generation")).toHaveLength(2);
    expect(labelLines("Python")).toEqual(["Python"]);
    // Every circle is big enough for the name drawn inside it.
    for (const name of NAMES) expect(nodeRadius(0, false, false, name) * 2).toBeGreaterThan(Math.max(...labelLines(name).map((l) => l.length * 6.6)));
  });

  it("lays out the real engine graph cleanly", () => {
    const engine = JSON.parse(readFileSync(path.join(__dirname, "../../../e2e/fixtures/engine-profile.json"), "utf8"));
    const g = engine.intelligence.graph;
    const nodes = g.nodes.map((n: { id: string; name: string; category: string; status: "verified" | "claimed" | "inferred"; evidenceCount: number }) => ({
      id: n.id, name: n.name, group: clusterOf(n), evidenceCount: n.evidenceCount, suggested: n.status === "inferred",
    }));
    for (const width of [320, 640]) {
      const layout = layoutSkillNetwork(nodes, g.edges, width);
      expect(overlaps(layout)).toEqual([]);
      expect(outOfBounds(layout)).toEqual([]);
    }
  });
});

describe("dashboard links", () => {
  it("treats only unbuilt modules as placeholders", async () => {
    const { isPlaceholderPath } = await import("./nav");
    for (const href of ["/eris", "/mentor", "/meet", "/avasar", "/collaborate", "/opportunities?x=1"]) expect(isPlaceholderPath(href), href).toBe(true);
    for (const href of ["/skills", "/learn", "/projects", "/profile", "/connections", "#career-roadmap", "https://course.fast.ai/"]) expect(isPlaceholderPath(href), href).toBe(false);
  });
});
