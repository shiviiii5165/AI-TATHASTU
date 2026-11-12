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

/**
 * Engine v4: what the strongest evidence for a skill is. assessed (platform or assessment) > demonstrated (code in a
 * repository: language statistics, a dependency file or structure) > repository_mention (topics, description or README
 * only) > described (the student's own resume or profile) > claimed (listed only). not_found / inferred for role rows.
 */
export type EvidenceBasis = "assessed" | "demonstrated" | "detected" | "repository_mention" | "described" | "claimed" | "inferred" | "not_found";

/** Engine v4: what a skill is. A career role is never a skill. */
export type SkillKind = "language" | "framework" | "tool" | "platform" | "concept" | "capability" | "unknown";

/** Engine v4 student-facing gap categories (career_engine.CATEGORY). Missing evidence is never called missing ability. */
export type GapCategory = "meets" | "needs_practice" | "proof_needed" | "foundation" | "not_shown" | "possibly" | "not_assessed";

export type EngineSkill = {
  name: string;
  category: string;
  status: SkillStatus;
  /** Absent on documents from engine versions before 3. */
  evidenceState?: EvidenceState;
  /** Engine v4 fields; absent on older documents. */
  kind?: SkillKind;
  evidenceBasis?: EvidenceBasis;
  /** The evidence behind the level, in words ("Code that uses it in 3 repositories"). */
  levelBasis?: string[];
  /** Why the level can't go higher yet, when an evidence gate is what stops it. */
  levelCap?: string | null;
  /** What would raise the level. */
  nextLevel?: string | null;
  codeRepositories?: number;
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
  /** Engine v3+: required competencies decide the goal; supporting ones are optional. v4 adds specialisation rows (separate list). */
  tier?: "required" | "supporting" | "specialisation";
  /** Engine v4 fields; absent on older documents. */
  kind?: SkillKind;
  category?: GapCategory;
  categoryLabel?: string;
  /** Why this role needs it (role framework rationale). */
  rationale?: string;
  /** Behavioural description of the expected level for this skill, and of the current one. */
  expectedCriterion?: string | null;
  currentCriterion?: string | null;
  evidenceBasis?: EvidenceBasis;
  levelBasis?: string[];
  nextLevel?: string | null;
  unblocks?: string[];
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

/**
 * ERIS — Intelligence Score, written by the engine (career_engine.alignment_score): how much of the role's
 * competency framework the evidence backs, 0-100. null when it can't be assessed; absent on documents computed
 * before the engine produced it. Never computed in the web app.
 */
export type AlignmentScore = {
  value: number;
  version: number;
  required: { score: number | null; competencies: number };
  supporting: { score: number | null; competencies: number };
  counts: { evidenced: number; described: number; none: number };
};

export type FrameworkReference = { title: string; publisher: string; kind: string; url: string; checkedAt: string };

export type SpecialisationTrack = { track: string; description?: string; skills?: RoleSkillRow[]; met: number; total: number };

export type RoleAnalysis = {
  role: string;
  label?: string;
  framework?: FrameworkMeta & {
    responsibilities: string[];
    completionCriteria: string;
    summary?: string;
    distinguishingFocus?: string;
    practicalCapabilities?: string[];
    projectContext?: string | null;
    references?: FrameworkReference[];
  };
  alignment?: RoleAlignment;
  alignmentScore?: AlignmentScore | null;
  /** Internal weighted share of competencies met. Not for display: the dashboard shows `alignment`. */
  coverage: number;
  assessed: boolean;
  skills: RoleSkillRow[];
  /** Empty when `compact` (secondary goals): derive with openRows() from lib/dashboard/intelligence. */
  open: RoleSkillRow[];
  counts: Record<GapState, number>;
  /** Engine v4: secondary goals are stored without per-row explanations, and with `open` left empty. */
  compact?: boolean;
  specialisations?: SpecialisationTrack[];
  categoryCounts?: Record<GapCategory, number>;
};

export type LearningResource = {
  title: string;
  provider: string | null;
  url: string;
  description: string | null;
  difficulty: string;
  duration: string | null;
  linkCheckedOn: string;
  linkStale: boolean;
  /** Engine v4 fields: from the curated, link-checked catalogue (worker/intelligence/learning_catalogue.json). */
  id?: string;
  type?: string;
  typeLabel?: string;
  focus?: "practical" | "theory" | "mixed";
  levelWindow?: { start: string; reach: string };
  outcome?: string;
  /** Why this resource fits this student, in words. */
  fitReason?: string;
  /** True when it starts above the student's current level (used only when nothing else fits). */
  stretch?: boolean;
  unmetPrerequisites?: string[];
  alsoCovers?: string[];
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
  resource: LearningResource | null;
  demonstration: string;
  status: "not_started" | "in_progress";
  tier?: "required" | "supporting" | "specialisation" | "project" | "prerequisite" | null;
  gapType?: GapType;
  courseStatus?: "recommended" | "started" | "completed" | null;
  /** Engine v4 fields. */
  sources?: GapSource[];
  projectImportance?: "core" | "supporting" | null;
  category?: GapCategory;
  inventoryRank?: number;
  alternative?: LearningResource | null;
  /** Why there's no resource, when there isn't one. */
  noResourceReason?: string | null;
  outcome?: string | null;
  evidenceToShow?: string;
};

export type GapSource = "career" | "project" | "prerequisite";

/** Engine v4: one row per relevant skill, from the career framework, the student's project and their prerequisites. */
export type GapInventoryRow = RoleSkillRow & {
  sources: GapSource[];
  roleTier: "required" | "supporting" | "specialisation" | null;
  projectImportance: "core" | "supporting" | null;
  projectWhy?: string;
  triggers?: string[];
  prerequisiteOf?: string[];
  inventoryReason: string;
  inventoryRank?: number;
  priorityGroup: number;
  priorityGroupLabel: string;
};

export type ProjectRequirementRow = RoleSkillRow & { importance: "core" | "supporting"; why: string; triggers: string[]; careerTier: string | null };

/** Engine v4: what the student said they want to build, and what that project needs. */
export type ProjectAnalysis = {
  version: number;
  status: "none" | "too_vague" | "analysed";
  text: string | null;
  source: "profile" | "onboarding_other" | null;
  method: string;
  prompts: string[];
  reason?: string;
  matched: { rule: string; label: string; phrases: string[] }[];
  /** Not stored from engine v4 on (the rows and the gap inventory carry it). */
  requirements?: { skill: string; importance: "core" | "supporting"; why: string; triggers: string[] }[];
  rows: ProjectRequirementRow[];
  /** Engine v4 intent v2: readings from a single ambiguous word. Never in the plan; shown with `questions` to confirm. */
  possible?: { skill: string; importance: "core" | "supporting"; why: string; triggers: string[]; certainty: "possible" }[];
  questions?: string[];
  summary: { core: number; coreReady: number; supporting: number } | null;
  overlap: string[];
  projectOnly: string[];
  careerOnly: string[];
  closestRoles: { role: string; label: string; overlap: string[]; coreCovered: number; core: number; requiredOverlap: number }[];
};

export type DataCoverageSource = { id: string; label: string; status: "used" | "missing"; detail: string; limits: string[] };
export type DataCoverage = { sources: DataCoverageSource[]; repositoriesRead: number; repositories: number; limitations: string[] };

export type RoadmapAchievement = {
  id: string;
  skill: string;
  tier: string | null;
  level: string;
  expectedLevel: string;
  title: string;
  evidence: string | null;
  evidenceAt: string | null;
  basis: EvidenceBasis | null;
  forProject: boolean;
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
  recommendedResource?: { title: string; url: string; provider?: string; fitReason?: string } | null;
  priorityReason?: string | null;
  /** Engine v4 fields. */
  category?: GapCategory;
  sources?: GapSource[];
  projectImportance?: "core" | "supporting" | null;
  /** The project this work fits into (the role's or the student's own). Shown apart from the task. */
  context?: string | null;
  levelBasis?: string[];
  nextLevel?: string | null;
  /** What the engine could do with evidence the student submitted for this milestone. */
  submissionCheck?: { url: string; status: "read" | "not_readable"; repository?: string; message: string } | null;
};
export type RoadmapStage = {
  key: string;
  title: string;
  optional?: boolean;
  milestones: RoadmapMilestone[];
  estimateWeeks: number | null;
  /** Engine v4: why the stage exists, what it covers, how it completes and what it unlocks. */
  purpose?: string;
  focus?: string | null;
  skills?: string[];
  buildsOn?: string[];
  requiresStages?: string[];
  unlocks?: string | null;
  unlocksTitle?: string | null;
  projectSkills?: number;
  completionCriteria?: string;
};
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
  /** Engine v4: competencies met from evidence, each with the evidence that met it. */
  achievements?: RoadmapAchievement[];
  project?: { text: string; status: string; core: number | null; coreReady: number | null } | null;
};

export type SkillGraphNode = {
  id: string;
  name: string;
  category: string;
  kind?: SkillKind;
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
  counts: { verified: number; claimed: number; inferred: number; assessed: number; roleSkills?: number };
  /** Engine v4 fields; absent on older documents. */
  project?: ProjectAnalysis;
  gapInventory?: GapInventoryRow[];
  dataCoverage?: DataCoverage;
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
