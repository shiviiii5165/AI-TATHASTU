import { describe, expect, it } from "vitest";

import { csvCell } from "./csv";
import { cohortKey, computeRanking, evenWeights, normalizeColumn, validateDefinition } from "./engine";
import { parseReportedGrade } from "./grade";
import type { BenchmarkDef, RankingDefinition, SignalMatrix, SignalValue, Verification } from "./types";

const bench = (key: string, extra: Partial<BenchmarkDef> = {}): BenchmarkDef => ({
  key, label: key, family: "F", description: "", unit: "", scale: "count", verification: "verified", source: "test", defaultNormalization: "percentile", ...extra,
});
const catalogue = new Map(["a", "b", "c", "p"].map((k) => [k, bench(k, k === "p" ? { scale: "percent" } : {})]));
const sv = (value: number, verification: Verification = "verified"): SignalValue => ({ value, verification, source: "t" });
const matrix = (rows: Record<string, Record<string, SignalValue>>): SignalMatrix =>
  new Map(Object.entries(rows).map(([u, r]) => [u, new Map(Object.entries(r))]));

const def = (over: Partial<RankingDefinition> = {}): RankingDefinition => ({
  schema: 1,
  categories: [
    { id: "x", name: "X", weight: 60, benchmarks: [{ key: "a", weight: 50, normalization: "minmax" }, { key: "b", weight: 50, normalization: "minmax" }] },
    { id: "y", name: "Y", weight: 40, benchmarks: [{ key: "p", weight: 100, normalization: "absolute" }] },
  ],
  cohort: {},
  eligibility: { minCoverage: 0, requiredBenchmarks: [] },
  evidencePolicy: "any",
  missingPolicy: "renormalize",
  ...over,
});

describe("validateDefinition", () => {
  const known = new Set(catalogue.keys());
  it("accepts weights that total 100 at both levels", () => {
    expect(validateDefinition(def(), known)).toEqual([]);
  });
  it("rejects category and benchmark totals other than 100", () => {
    const d = def();
    d.categories[0].weight = 50;
    d.categories[1].benchmarks[0].weight = 90;
    const msgs = validateDefinition(d, known).map((i) => i.message).join(" ");
    expect(msgs).toContain("Category weights total 90%");
    expect(msgs).toContain('Benchmark weights in "Y" total 90%');
  });
  it("rejects the same benchmark twice (duplicate evidence) and unknown benchmarks", () => {
    const d = def();
    d.categories[1].benchmarks = [{ key: "a", weight: 50, normalization: "minmax" }, { key: "zz", weight: 50, normalization: "minmax" }];
    const msgs = validateDefinition(d, known).map((i) => i.message).join(" ");
    expect(msgs).toContain("more than once");
    expect(msgs).toContain('Unknown benchmark "zz"');
  });
  it("needs a target for target normalization", () => {
    const d = def();
    d.categories[1].benchmarks[0] = { key: "p", weight: 100, normalization: "target" };
    expect(validateDefinition(d, known).some((i) => i.message.includes("needs a target"))).toBe(true);
  });
});

describe("normalizeColumn", () => {
  const col = new Map([["u1", 10], ["u2", 20], ["u3", 20], ["u4", 40]]);
  it("percentile uses mid-rank ties", () => {
    const n = normalizeColumn(col, "percentile");
    expect(n.get("u1")).toBe(12.5);
    expect(n.get("u2")).toBe(50);
    expect(n.get("u3")).toBe(50);
    expect(n.get("u4")).toBe(87.5);
  });
  it("minmax spans 0-100, and puts everyone at 50 when all values are equal", () => {
    expect(normalizeColumn(col, "minmax").get("u4")).toBe(100);
    expect(normalizeColumn(col, "minmax").get("u1")).toBe(0);
    expect(normalizeColumn(new Map([["a", 3], ["b", 3]]), "minmax").get("a")).toBe(50);
  });
  it("target caps at 100 and absolute clamps", () => {
    expect(normalizeColumn(new Map([["a", 10]]), "target", { target: 5 }).get("a")).toBe(100);
    expect(normalizeColumn(new Map([["a", 2]]), "target", { target: 5 }).get("a")).toBe(40);
    expect(normalizeColumn(new Map([["a", 130]]), "absolute").get("a")).toBe(100);
  });
  it("supports lower-is-better", () => {
    const n = normalizeColumn(new Map([["fast", 1], ["slow", 9]]), "minmax", { lowerIsBetter: true });
    expect(n.get("fast")).toBe(100);
    expect(n.get("slow")).toBe(0);
  });
});

describe("computeRanking", () => {
  const signals = matrix({
    u1: { a: sv(10), b: sv(10), p: sv(90) },
    u2: { a: sv(20), b: sv(20), p: sv(50) },
    u3: { p: sv(70) }, // no evidence in X
    u4: {}, // nothing
  });

  it("computes the documented formula", () => {
    const r = computeRanking(def(), ["u1", "u2"], signals, catalogue);
    const u2 = r.find((x) => x.userId === "u2")!;
    // X: both at max → 100; Y: 50. Final = 0.6*100 + 0.4*50 = 80.
    expect(u2.score).toBe(80);
    const u1 = r.find((x) => x.userId === "u1")!;
    expect(u1.score).toBe(36); // 0.6*0 + 0.4*90
    expect(r[0].userId).toBe("u2");
    expect(r[0].rank).toBe(1);
  });

  it("never treats missing evidence as zero by default: it re-weights and reports coverage", () => {
    const r = computeRanking(def(), ["u1", "u2", "u3"], signals, catalogue);
    const u3 = r.find((x) => x.userId === "u3")!;
    expect(u3.categories[0].score).toBeNull();
    expect(u3.categories[0].benchmarks[0].status).toBe("no_evidence");
    expect(u3.score).toBe(70); // only Y counted
    expect(u3.coverage).toBe(40);
  });

  it("counts missing as zero only when the admin chooses it", () => {
    const r = computeRanking(def({ missingPolicy: "zero" }), ["u1", "u2", "u3"], signals, catalogue);
    // X has no evidence, so under "zero" it scores 0 instead of dropping out: 0.6×0 + 0.4×70.
    expect(r.find((x) => x.userId === "u3")!.score).toBe(28);
    const partial = matrix({ u1: { a: sv(10), p: sv(10) }, u2: { a: sv(20), b: sv(20), p: sv(10) } });
    const z = computeRanking(def({ missingPolicy: "zero" }), ["u1", "u2"], partial, catalogue);
    // u1: a=0 (min), b missing → 0 with weight; X = 0
    expect(z.find((x) => x.userId === "u1")!.categories[0].score).toBe(0);
  });

  it("neutral policy: one strong narrow value can't outrank broad evidence, and an empty category shows no score", () => {
    const s = matrix({
      narrow: { p: sv(95) },
      broad: { a: sv(20), b: sv(20), p: sv(60) },
      low: { a: sv(10), b: sv(10), p: sv(60) },
    });
    const r = computeRanking(def({ missingPolicy: "neutral" }), ["narrow", "broad", "low"], s, catalogue);
    const narrow = r.find((x) => x.userId === "narrow")!;
    expect(narrow.categories[0].score).toBeNull(); // shows "no evidence", not 50
    expect(narrow.score).toBe(68); // 0.6×50 (midpoint) + 0.4×95
    expect(r.find((x) => x.userId === "broad")!.score).toBe(84); // 0.6×100 + 0.4×60
    expect(r[0].userId).toBe("broad");
    // Under renormalize the same narrow profile would win with 95.
    expect(computeRanking(def(), ["narrow", "broad", "low"], s, catalogue)[0].userId).toBe("narrow");
  });

  it("marks thin or mostly self-reported evidence provisional, without changing the rank", () => {
    const s = matrix({
      firm: { a: sv(20), b: sv(20), p: sv(80) },
      selfish: { a: sv(10, "self_reported"), b: sv(10, "self_reported"), p: sv(60, "self_reported") },
      thin: { p: sv(90) },
    });
    const r = computeRanking(def({ missingPolicy: "neutral" }), ["firm", "selfish", "thin"], s, catalogue);
    const by = (u: string) => r.find((x) => x.userId === u)!;
    expect(by("firm")).toMatchObject({ provisional: false, independentShare: 100 });
    expect(by("selfish").provisional).toBe(true);
    expect(by("selfish").independentShare).toBe(0);
    expect(by("selfish").provisionalReasons[0]).toContain("independent");
    expect(by("thin").provisional).toBe(true);
    expect(by("thin").provisionalReasons[0]).toContain("40%");
    expect(by("thin").rank).not.toBeNull(); // still ranked
    const lenient = computeRanking(def({ missingPolicy: "neutral", eligibility: { minCoverage: 0, requiredBenchmarks: [], provisionalCoverage: 0, minIndependentShare: 0 } }), ["thin"], s, catalogue);
    expect(lenient[0].provisional).toBe(false);
  });

  it("makes students below minimum coverage ineligible, with a reason, and gives them no rank", () => {
    const r = computeRanking(def({ eligibility: { minCoverage: 50, requiredBenchmarks: [] } }), ["u1", "u2", "u3", "u4"], signals, catalogue);
    const u3 = r.find((x) => x.userId === "u3")!;
    expect(u3.eligible).toBe(false);
    expect(u3.rank).toBeNull();
    expect(u3.ineligibleReasons[0]).toContain("40%");
    expect(r.find((x) => x.userId === "u4")!.ineligibleReasons[0]).toContain("No evidence");
  });

  it("enforces required benchmarks", () => {
    const r = computeRanking(def({ eligibility: { minCoverage: 0, requiredBenchmarks: ["a"] } }), ["u1", "u3"], signals, catalogue);
    expect(r.find((x) => x.userId === "u3")!.eligible).toBe(false);
  });

  it("applies the evidence policy before normalising", () => {
    const s = matrix({ u1: { p: sv(90, "self_reported") }, u2: { p: sv(50, "verified") } });
    const d = def({ categories: [{ id: "y", name: "Y", weight: 100, benchmarks: [{ key: "p", weight: 100, normalization: "absolute" }] }], evidencePolicy: "exclude_self_reported" });
    const r = computeRanking(d, ["u1", "u2"], s, catalogue);
    expect(r[0].userId).toBe("u2");
    const u1 = r.find((x) => x.userId === "u1")!;
    expect(u1.eligible).toBe(false);
    expect(u1.categories[0].benchmarks[0].status).toBe("excluded_by_policy");
  });

  it("gives tied scores the same rank (1, 2, 2, 4)", () => {
    const s = matrix({ a: { p: sv(90) }, b: { p: sv(70) }, c: { p: sv(70) }, d: { p: sv(10) } });
    const d = def({ categories: [{ id: "y", name: "Y", weight: 100, benchmarks: [{ key: "p", weight: 100, normalization: "absolute" }] }] });
    const ranks = computeRanking(d, ["a", "b", "c", "d"], s, catalogue).map((r) => r.rank);
    expect(ranks).toEqual([1, 2, 2, 4]);
  });

  it("is deterministic", () => {
    const a = computeRanking(def(), ["u1", "u2", "u3"], signals, catalogue);
    const b = computeRanking(def(), ["u3", "u2", "u1"], signals, catalogue);
    expect(a.map((r) => [r.userId, r.rank, r.score])).toEqual(b.map((r) => [r.userId, r.rank, r.score]));
  });
});

describe("helpers", () => {
  it("evenWeights totals exactly 100", () => {
    for (const n of [1, 3, 6, 7, 11]) expect(evenWeights(n).reduce((a, b) => a + b, 0)).toBe(100);
  });
  it("cohortKey is order-independent and ignores empty values", () => {
    expect(cohortKey({ b: "2", a: "1", c: "" })).toBe(cohortKey({ a: "1", b: "2" }));
    expect(cohortKey({})).toBe("all");
  });
  it("csvCell neutralises formulas but keeps negative numbers", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell(-3.5)).toBe(`"-3.5"`);
    expect(csvCell('a"b')).toBe(`"a""b"`);
  });
});

describe("parseReportedGrade", () => {
  it.each([
    ["8.6/10", 86], ["CGPA: 9.1", 91], ["3.4 / 4", 85], ["86%", 86], ["8.2 out of 10", 82],
  ])("%s → %s", (input, pct) => expect(parseReportedGrade(input)?.percent).toBe(pct));
  it.each(["First class", "3.5", "GPA 3.5", "12/10", ""])("refuses ambiguous %s", (input) => expect(parseReportedGrade(input)).toBeNull());
});
