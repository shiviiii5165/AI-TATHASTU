// The ranking engine. Pure and deterministic: the same definition and the same evidence always give the same ranks,
// which is what makes published rankings reproducible and every score explainable.
//
//   Benchmark score  = normalize(raw value) on 0-100, or "no evidence" (never silently 0)
//   Category score   = Σ (benchmark weight × benchmark score) / Σ weight of benchmarks that have evidence
//   Final score      = Σ (category weight × category score)  / Σ weight of categories that have evidence
//   Coverage         = share of the total weight that is backed by evidence
//
// missingPolicy "neutral" places unmeasured benchmarks at the cohort midpoint (shrinkage: recommended for broad rankings);
// "zero" is an explicit admin choice to count missing evidence as 0.

import {
  acceptedBy,
  type BenchmarkDef,
  type BenchmarkResult,
  type CategoryResult,
  type Normalization,
  type RankingDefinition,
  type SignalMatrix,
  type StudentResult,
  type ValidationIssue,
} from "./types";

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Cohort midpoint used for unmeasured benchmarks under missingPolicy "neutral". */
export const NEUTRAL = 50;
const clamp = (n: number) => Math.max(0, Math.min(100, n));

/** Weight totals and references. A definition with any issue can be previewed but never published. */
export function validateDefinition(def: RankingDefinition, known: ReadonlySet<string>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (def.categories.length === 0) issues.push({ path: "categories", message: "Add at least one category." });
  const catTotal = def.categories.reduce((s, c) => s + c.weight, 0);
  if (def.categories.length && Math.abs(catTotal - 100) > 0.01)
    issues.push({ path: "categories", message: `Category weights total ${round2(catTotal)}%, not 100%.` });
  const seen = new Set<string>();
  for (const c of def.categories) {
    if (!c.name.trim()) issues.push({ path: `category:${c.id}`, message: "A category needs a name." });
    if (c.weight <= 0) issues.push({ path: `category:${c.id}`, message: `"${c.name}" has no weight.` });
    if (c.benchmarks.length === 0) issues.push({ path: `category:${c.id}`, message: `"${c.name}" has no benchmarks.` });
    const total = c.benchmarks.reduce((s, b) => s + b.weight, 0);
    if (c.benchmarks.length && Math.abs(total - 100) > 0.01)
      issues.push({ path: `category:${c.id}`, message: `Benchmark weights in "${c.name}" total ${round2(total)}%, not 100%.` });
    for (const b of c.benchmarks) {
      if (!known.has(b.key)) issues.push({ path: `benchmark:${b.key}`, message: `Unknown benchmark "${b.key}".` });
      // The same evidence counted twice would weigh it twice.
      if (seen.has(b.key)) issues.push({ path: `benchmark:${b.key}`, message: `A benchmark is used more than once.` });
      seen.add(b.key);
      if (b.weight <= 0) issues.push({ path: `benchmark:${b.key}`, message: `A benchmark in "${c.name}" has no weight.` });
      if (b.normalization === "target" && !(b.target && b.target > 0))
        issues.push({ path: `benchmark:${b.key}`, message: `A target-normalized benchmark in "${c.name}" needs a target above 0.` });
    }
  }
  if (def.eligibility.minCoverage < 0 || def.eligibility.minCoverage > 100)
    issues.push({ path: "eligibility", message: "Minimum coverage must be between 0 and 100." });
  return issues;
}

/** Normalizes every value of one benchmark across the cohort. Only students with accepted evidence take part. */
export function normalizeColumn(
  values: Map<string, number>,
  method: Normalization,
  opts: { target?: number; lowerIsBetter?: boolean } = {},
): Map<string, number> {
  const out = new Map<string, number>();
  const entries = [...values.entries()];
  if (entries.length === 0) return out;
  const sign = opts.lowerIsBetter ? -1 : 1;
  if (method === "absolute") {
    for (const [u, v] of entries) out.set(u, clamp(opts.lowerIsBetter ? 100 - v : v));
    return out;
  }
  if (method === "target") {
    const t = opts.target && opts.target > 0 ? opts.target : 1;
    for (const [u, v] of entries) out.set(u, clamp(opts.lowerIsBetter ? (t / Math.max(v, 1e-9)) * 100 : (v / t) * 100));
    return out;
  }
  if (method === "minmax") {
    const vs = entries.map(([, v]) => v * sign);
    const min = Math.min(...vs);
    const max = Math.max(...vs);
    // Everyone equal: no spread to rank on, so all sit in the middle rather than at the top or bottom.
    for (const [u, v] of entries) out.set(u, max === min ? 50 : ((v * sign - min) / (max - min)) * 100);
    return out;
  }
  // Percentile with mid-rank ties: (below + ½·equal) / n.
  const sorted = entries.map(([, v]) => v * sign).sort((a, b) => a - b);
  const n = sorted.length;
  for (const [u, v] of entries) {
    const x = v * sign;
    let below = 0;
    let equal = 0;
    for (const s of sorted) {
      if (s < x) below++;
      else if (s === x) equal++;
    }
    out.set(u, ((below + equal / 2) / n) * 100);
  }
  return out;
}

export function computeRanking(
  def: RankingDefinition,
  cohort: string[],
  signals: SignalMatrix,
  catalogue: ReadonlyMap<string, BenchmarkDef>,
): StudentResult[] {
  // 1. Normalize each benchmark column over the cohort, using only evidence the policy accepts.
  const normalized = new Map<string, Map<string, number>>();
  for (const c of def.categories) {
    for (const b of c.benchmarks) {
      const column = new Map<string, number>();
      for (const u of cohort) {
        const s = signals.get(u)?.get(b.key);
        if (s && acceptedBy(def.evidencePolicy, s.verification)) column.set(u, s.value);
      }
      normalized.set(b.key, normalizeColumn(column, b.normalization, { target: b.target, lowerIsBetter: catalogue.get(b.key)?.lowerIsBetter }));
    }
  }

  const totalCatWeight = def.categories.reduce((s, c) => s + c.weight, 0) || 1;

  // 2. Score each student.
  const results: StudentResult[] = cohort.map((userId) => {
    const own = signals.get(userId);
    let finalNum = 0;
    let finalDen = 0;
    let coveredWeight = 0;
    const categories: CategoryResult[] = def.categories.map((c) => {
      const catTotal = c.benchmarks.reduce((s, b) => s + b.weight, 0) || 1;
      let num = 0;
      let den = 0;
      let missingW = 0;
      const benchmarks: BenchmarkResult[] = c.benchmarks.map((b) => {
        const s = own?.get(b.key);
        const n = normalized.get(b.key)?.get(userId);
        const label = catalogue.get(b.key)?.label ?? b.key;
        if (n === undefined) {
          missingW += b.weight;
          return {
            key: b.key, label, weight: b.weight, raw: s ? s.value : null, normalized: null,
            verification: s?.verification ?? null, source: s?.source ?? null,
            status: s ? "excluded_by_policy" : "no_evidence",
          };
        }
        num += b.weight * n;
        den += b.weight;
        return { key: b.key, label, weight: b.weight, raw: s!.value, normalized: round2(n), verification: s!.verification, source: s!.source, status: "scored" };
      });
      const covered = benchmarks.filter((r) => r.status === "scored").reduce((s, r) => s + r.weight, 0);
      const coverage = (covered / catTotal) * 100;
      // score: what the category shows. contribution: what it adds to the final score.
      let score: number | null;
      let contribution: number | null;
      if (def.missingPolicy === "zero") {
        score = den + missingW > 0 ? num / (den + missingW) : null;
        contribution = score;
      } else if (def.missingPolicy === "neutral") {
        // Shrinkage: unmeasured benchmarks sit at the cohort midpoint (50), so a narrow profile can't outrank a broad one
        // on a single strong value, and missing evidence is never punished as 0. A category with no evidence shows none.
        score = den > 0 ? (num + missingW * NEUTRAL) / (den + missingW) : null;
        contribution = score ?? NEUTRAL;
      } else {
        score = den > 0 ? num / den : null;
        contribution = score;
      }
      if (contribution !== null) {
        finalNum += c.weight * contribution;
        finalDen += c.weight;
      }
      coveredWeight += (c.weight * coverage) / 100;
      return { id: c.id, name: c.name, weight: c.weight, score: score === null ? null : round2(score), coverage: round2(coverage), benchmarks };
    });

    const coverage = round2((coveredWeight / totalCatWeight) * 100);
    const reasons: string[] = [];
    if (finalDen === 0 || coverage === 0) reasons.push("No evidence for any benchmark in this ranking.");
    else if (coverage < def.eligibility.minCoverage) reasons.push(`Evidence covers ${coverage}% of the weight; this ranking needs ${def.eligibility.minCoverage}%.`);
    for (const key of def.eligibility.requiredBenchmarks) {
      const has = categories.some((c) => c.benchmarks.some((b) => b.key === key && b.status === "scored"));
      if (!has) reasons.push(`Required benchmark has no accepted evidence: ${catalogue.get(key)?.label ?? key}.`);
    }
    const score = finalDen > 0 ? round2(finalNum / finalDen) : null;

    // Evidence quality: of the weight that was actually scored, how much rests on more than the student's word.
    let scoredW = 0;
    let independentW = 0;
    for (const c of categories) {
      for (const b of c.benchmarks) {
        if (b.status !== "scored") continue;
        const w = (c.weight * b.weight) / 100;
        scoredW += w;
        if (b.verification && b.verification !== "self_reported") independentW += w;
      }
    }
    const independentShare = scoredW > 0 ? round2((independentW / scoredW) * 100) : 0;
    const provisionalReasons: string[] = [];
    const eligible = reasons.length === 0;
    if (eligible) {
      const minCov = def.eligibility.provisionalCoverage ?? 75;
      const minInd = def.eligibility.minIndependentShare ?? 50;
      if (coverage < minCov) provisionalReasons.push(`Evidence covers ${coverage}% of the weight (firm ranks need ${minCov}%).`);
      if (independentShare < minInd) provisionalReasons.push(`Only ${independentShare}% of the scored evidence is independent of self-report (firm ranks need ${minInd}%).`);
    }
    return {
      userId, score, coverage, rank: null, eligible, ineligibleReasons: reasons, categories,
      independentShare, provisional: provisionalReasons.length > 0, provisionalReasons,
    };
  });

  // 3. Rank the eligible: highest score first, ties share a rank (1, 2, 2, 4); within a tie, more coverage lists first.
  const eligible = results.filter((r) => r.eligible).sort((a, b) => (b.score! - a.score!) || (b.coverage - a.coverage) || a.userId.localeCompare(b.userId));
  let prev: number | null = null;
  let prevRank = 0;
  eligible.forEach((r, i) => {
    r.rank = prev !== null && r.score === prev ? prevRank : i + 1;
    prev = r.score;
    prevRank = r.rank;
  });
  const ineligible = results.filter((r) => !r.eligible).sort((a, b) => b.coverage - a.coverage || a.userId.localeCompare(b.userId));
  return [...eligible, ...ineligible];
}

/** Stable key for a cohort filter, so movement compares like with like. */
export function cohortKey(cohort: Record<string, string | undefined>): string {
  return Object.entries(cohort)
    .filter(([, v]) => v)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("&") || "all";
}

/** Splits weight evenly (integers that total exactly 100), for the builder's "distribute evenly". */
export function evenWeights(n: number): number[] {
  if (n <= 0) return [];
  const base = Math.floor(100 / n);
  const rest = 100 - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < rest ? 1 : 0));
}
