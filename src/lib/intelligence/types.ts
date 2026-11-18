// Shared types for the admin Student Intelligence module. Pure: no database, no server-only imports,
// so the ranking engine and the builder UI use exactly the same shapes.

/**
 * How trustworthy a value is, strongest first. A ranking can exclude the weaker levels.
 *  verified       read directly from an account the student authorised (GitHub OAuth) or verified by an operator
 *  external       read from a public profile on another platform (LeetCode, HackerRank, ORCID…)
 *  engine         calculated by the career engine from mixed evidence (its own evidence rules apply)
 *  ai_assessed    judged by a language model (repository impact): a hypothesis, not a measurement
 *  self_reported  stated by the student (resume, profile, submissions)
 */
export type Verification = "verified" | "external" | "engine" | "ai_assessed" | "self_reported";

export const VERIFICATION_ORDER: Verification[] = ["verified", "external", "engine", "ai_assessed", "self_reported"];

export const VERIFICATION_LABEL: Record<Verification, string> = {
  verified: "Verified",
  external: "External platform",
  engine: "Engine-assessed",
  ai_assessed: "AI-assessed",
  self_reported: "Self-reported",
};

/** Which values a ranking accepts. */
export type EvidencePolicy = "any" | "exclude_self_reported" | "verified_only";

export const EVIDENCE_POLICY_LABEL: Record<EvidencePolicy, string> = {
  any: "All evidence (self-reported included)",
  exclude_self_reported: "Exclude self-reported evidence",
  verified_only: "Verified and external-platform evidence only",
};

export function acceptedBy(policy: EvidencePolicy, v: Verification): boolean {
  if (policy === "any") return true;
  if (policy === "exclude_self_reported") return v !== "self_reported";
  return v === "verified" || v === "external";
}

/**
 * percentile  rank within the cohort among students who have a value (ties share the mid-rank) → 0-100
 * minmax      position between the cohort's lowest and highest value → 0-100
 * absolute    the value is already on a 0-100 scale (engine proficiency, ERIS…) → used as is
 * target      value ÷ admin-set target × 100, capped at 100 ("5 publications = full marks")
 */
export type Normalization = "percentile" | "minmax" | "absolute" | "target";

export const NORMALIZATION_LABEL: Record<Normalization, string> = {
  percentile: "Percentile in cohort",
  minmax: "Min–max in cohort",
  absolute: "Native 0–100 scale",
  target: "Against a target",
};

export const MISSING_POLICY_LABEL: Record<RankingDefinition["missingPolicy"], string> = {
  neutral: "Missing evidence sits at the cohort midpoint",
  renormalize: "Missing evidence excluded and re-weighted",
  zero: "Missing evidence counted as 0",
};

export type BenchmarkScale = "percent" | "count" | "continuous";

export interface BenchmarkDef {
  key: string;
  label: string;
  /** Evidence family: groups benchmarks in the catalogue and the builder. Not a fixed ranking category. */
  family: string;
  description: string;
  unit: string;
  scale: BenchmarkScale;
  /** The verification level a value of this benchmark carries (skills: per value, see SignalValue). */
  verification: Verification;
  source: string;
  defaultNormalization: Normalization;
  /** For "target" normalization when the admin hasn't set one. */
  defaultTarget?: number;
  /** Lower raw values are better (none today; supported by the engine). */
  lowerIsBetter?: boolean;
}

export interface SignalValue {
  value: number;
  verification: Verification;
  /** Human-readable source line for explanations. */
  source: string;
}

/** userId → benchmark key → value. A missing key means "no evidence", never zero. */
export type SignalMatrix = Map<string, Map<string, SignalValue>>;

export interface BenchmarkWeight {
  key: string;
  /** Percent of its category, 0-100; a category's weights total 100. */
  weight: number;
  normalization: Normalization;
  target?: number;
}

export interface CategoryDef {
  id: string;
  name: string;
  /** Percent of the final score, 0-100; categories total 100. */
  weight: number;
  benchmarks: BenchmarkWeight[];
}

export interface CohortFilter {
  institutionId?: string;
  degreeId?: string;
  specializationId?: string;
  academicYear?: string;
  graduationYear?: string;
  careerRole?: string;
}

export interface RankingDefinition {
  schema: 1;
  categories: CategoryDef[];
  cohort: CohortFilter;
  eligibility: {
    /** Share (0-100) of the total weight that must be backed by evidence to receive a rank. */
    minCoverage: number;
    /** Benchmarks a student must have a value for. */
    requiredBenchmarks: string[];
    /** Ranked, but marked provisional below this coverage (0-100). Default 75. */
    provisionalCoverage?: number;
    /** Ranked, but marked provisional when less than this share (0-100) of the scored weight is independent of self-report. Default 50. */
    minIndependentShare?: number;
  };
  evidencePolicy: EvidencePolicy;
  /**
   * neutral: unmeasured benchmarks sit at the cohort midpoint (50), so one strong value can't top a broad ranking.
   * renormalize: missing benchmarks drop out and the remaining weights scale up (good for narrow, specialist rankings).
   * zero: missing counts as 0 (explicit choice; penalises students who weren't measured).
   */
  missingPolicy: "neutral" | "renormalize" | "zero";
}

export interface BenchmarkResult {
  key: string;
  label: string;
  weight: number;
  raw: number | null;
  normalized: number | null;
  verification: Verification | null;
  source: string | null;
  /** Why the value is missing when it is. */
  status: "scored" | "no_evidence" | "excluded_by_policy";
}

export interface CategoryResult {
  id: string;
  name: string;
  weight: number;
  score: number | null;
  /** Share (0-100) of this category's weight backed by evidence. */
  coverage: number;
  benchmarks: BenchmarkResult[];
}

export interface StudentResult {
  userId: string;
  score: number | null;
  coverage: number;
  rank: number | null;
  eligible: boolean;
  ineligibleReasons: string[];
  /** Share (0-100) of the scored weight backed by verified, external, engine or AI evidence rather than self-report. */
  independentShare: number;
  /** Ranked, but on thin or mostly self-reported evidence. */
  provisional: boolean;
  provisionalReasons: string[];
  categories: CategoryResult[];
}

export interface SnapshotRow {
  userId: string;
  rank: number | null;
  score: number | null;
  coverage: number;
  eligible: boolean;
  provisional?: boolean;
  categories: { id: string; score: number | null }[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}
