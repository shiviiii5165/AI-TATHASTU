import type { Persona } from "@/db/schema";

// Shape of profile_views.view as written by worker/intelligence/compute.py
// (VIEW_VERSION 1). Client-safe.

// "preview": the widget's layout is shown before its data source exists
// (faculty and alumni widgets that depend on modules still being built).
export type WidgetState = "ready" | "empty" | "partial" | "stale" | "preview";

export type ScoredWidget = {
  id: string;
  module: string;
  label: string;
  score: number;
  components: { I: number; G: number; R: number; F: number };
  state: WidgetState;
  data: unknown;
};

/** readiness is proficiency / 100, null when there's no score. state is absent only on rows written before the engine. */
export type SkillGap = { skill: string; readiness: number | null; weight: number; state?: GapState; level?: string; expectedLevel?: string };

// Written by worker/intelligence/career_engine.py, which documents the scoring.
export type SkillStatus = "verified" | "claimed" | "inferred";

export type SkillEvidenceRef = { kind: string; source: string; label: string; ref: string | null; at: string | null };

/**
 * How we know a skill (engine v3): demonstrated = a source we read ourselves; unverified = only the student's own
 * descriptions of projects or work; claimed = only listed; inferred = only suggested by related skills.
 */
export type EvidenceState = "demonstrated" | "unverified" | "claimed" | "inferred" | "missing";

export type EngineSkill = {
  name: string;
  category: string;
  status: SkillStatus;
  /** Absent on documents from engine versions before 3. */
  evidenceState?: EvidenceState;
  credential?: "verified" | "claimed" | null;
  coursesCompleted?: number;
  /** 0-100, or null for "Not assessed". */
  proficiency: number | null;
  level: string;
  confidence: number;
  evidenceCount: number;
  evidence: SkillEvidenceRef[];
  lastEvidenceAt: string | null;
  inferredFrom?: string[];
};

export type GapState = "met" | "underdeveloped" | "unverified" | "inferred" | "missing" | "not_assessed";

export type GapType = "completed" | "missing_competency" | "insufficient_proficiency" | "claimed_unverified" | "insufficient_evidence" | "not_assessed";

export type RoleSkillRow = {
  skill: string;
  /** Engine v3+: required competencies decide the goal; supporting ones are optional. */
  tier?: "required" | "supporting";
  evidenceRequirement?: "independent" | "described";
  evidenceState?: EvidenceState;
  gapType?: GapType;
  whyItMatters?: string;
  demonstration?: string | null;
  prerequisites?: string[];
  prerequisiteFor?: string[];
  blockedBy?: string[];
  priorityRank?: number;
  priorityReason?: string;
  weight: number;
  priority: "High" | "Medium" | "Low";
  expected: number;
  expectedLevel: string;
  proficiency: number | null;
  level: string;
  confidence: number;
  state: GapState;
  insufficientEvidence: boolean;
  action: string | null;
  evidence: string[];
};

export type AlignmentState = "not_enough_evidence" | "early" | "developing" | "strong" | "requirements_demonstrated";

/** Rule-based role alignment (career_engine.ALIGNMENT_RULES). Never shown as a percentage. */
export type RoleAlignment = {
  state: AlignmentState;
  label: string;
  required: number;
  requiredMet: number;
  requiredAssessed: number;
  requiredClaimedOnly: number;
  requiredMissing: number;
  supporting: number;
  supportingMet: number;
  criticalGaps: string[];
  foundationsMet: boolean;
};

export type FrameworkMeta = { version: string; status: string; basis?: string; reviewed?: boolean; alignmentRules?: string };

export type RoleAnalysis = {
  role: string;
  label?: string;
  framework?: FrameworkMeta & { responsibilities: string[]; completionCriteria: string };
  alignment?: RoleAlignment;
  /** Internal weighted share of competencies met. Not for display: the dashboard shows `alignment`. */
  coverage: number;
  assessed: boolean;
  skills: RoleSkillRow[];
  open: RoleSkillRow[];
  counts: Record<GapState, number>;
};

export type LearningRecommendation = {
  skill: string;
  targetLevel: string;
  currentLevel: string;
  current: number | null;
  state: GapState;
  priority: "High" | "Medium" | "Low";
  why: string;
  currentEvidence: string[];
  roles: string[];
  prerequisites: { skill: string; met: boolean }[];
  resource: { title: string; provider: string | null; url: string; description: string | null; difficulty: string; duration: string | null; linkCheckedOn: string; linkStale: boolean } | null;
  demonstration: string;
  status: "not_started" | "in_progress";
  tier?: "required" | "supporting";
  gapType?: GapType;
  courseStatus?: "recommended" | "started" | "completed" | null;
};

/** `id` is "<role>:<skill-slug>" from engine version 2; older documents lack it (see roadmap/progress.ts). */
export type RoadmapMilestone = {
  id?: string;
  skill: string;
  state: GapState;
  done: boolean;
  requires: string[];
  deliverable: string;
  criterion: string;
  /** null from engine v3: no time estimate is made without knowing the student's available hours. */
  estimateWeeks: number | null;
  gapType?: GapType;
  tier?: "required" | "supporting";
  optional?: boolean;
  objective?: string;
  why?: string;
  practicalTask?: string;
  evidenceRequired?: string;
  recommendedResource?: { title: string; url: string } | null;
  priorityReason?: string | null;
};
export type RoadmapStage = { key: string; title: string; optional?: boolean; milestones: RoadmapMilestone[]; estimateWeeks: number | null };
export type EngineRoadmap = {
  role: string;
  currentPosition: string | null;
  /** Internal coverage share; not displayed. */
  progress: number;
  completed: string[];
  stages: RoadmapStage[];
  assumption: string;
  alignment?: AlignmentState;
  requirementsMet?: boolean;
  provisional?: boolean;
  framework?: FrameworkMeta;
};

export type SkillGraphNode = {
  id: string;
  name: string;
  category: string;
  status: SkillStatus;
  level: string;
  proficiency: number | null;
  confidence: number;
  evidenceCount: number;
  evidence: SkillEvidenceRef[];
  inferredFrom: string[];
};

export type SkillGraphEdge = {
  source: string;
  target: string;
  relationship: string;
  /** "evidence": a shared repository or project. "ontology": a documented relation between the skills. */
  basis: "evidence" | "ontology";
  evidence: string[];
  weight: number;
};

export type SkillGraphData = { nodes: SkillGraphNode[]; edges: SkillGraphEdge[]; totalSkills: number };

export type IntelligenceDoc = {
  engineVersion: number;
  framework?: FrameworkMeta;
  computedAt: string;
  hasEvidenceBase: boolean;
  skills: EngineSkill[];
  inferred: EngineSkill[];
  roles: RoleAnalysis[];
  unsupportedRoles: string[];
  recommendations: LearningRecommendation[];
  roadmap: EngineRoadmap | null;
  graph: SkillGraphData;
  counts: { verified: number; claimed: number; inferred: number; assessed: number };
};

export type ProfileViewDoc = {
  version: number;
  computedAt: string;
  trigger: string | null;
  identity: { name: string | null; university: string | null; degree: string | null; careerRole: string | null };
  // Missing in views computed before personas existed: treat as student.
  persona?: Persona;
  goals: { primaryRole: string | null; roles: string[]; roleOther: string | null; priorities: string[] };
  skills: { name: string; category: string; evidenceStrength: number; sources: string[]; verificationStatus: string; evidenceState?: EvidenceState; proficiency?: number | null; level?: string; confidence?: number }[];
  projects: { canonicalTitle: string; technologies: string[]; status: string; matchConfidence: number }[];
  erisScore: { overall: number | null; byRole: Record<string, number>; gaps: SkillGap[] };
  readinessIndicators: { resumeLinked: boolean; connectorsCount: number; confirmedFacts: number; profileComplete?: number };
  /** Absent on views computed before the engine: those hold invented content, and it isn't shown. */
  intelligence?: IntelligenceDoc;
  skillGapsAndPaths?: {
    gaps: { skill: string; description: string; priority: string; action: string }[];
  };
  nextActions?: { num: number; title: string; desc: string; btnText: string; btnHref: string; category?: string }[];
  widgets: ScoredWidget[];
};

// Per-widget `data` payloads.
export type ErisData = { role: string | null; score: number; gaps: SkillGap[] };
export type SkillGapsData = { role: string | null; gaps: SkillGap[] };
export type CompletenessData = { percent: number; checks: { id: string; label: string; done: boolean }[] };
