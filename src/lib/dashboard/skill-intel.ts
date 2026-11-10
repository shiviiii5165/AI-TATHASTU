// Skills Intelligence view model: groups, colours and explanations derived only from the engine's skill graph
// (worker/intelligence/career_engine.py build_graph). Nothing here adds a skill, a score or a relationship.

import type { SkillEvidenceRef, SkillGraphData, SkillGraphEdge, SkillGraphNode } from "@/lib/dashboard/types";

export type ClusterKey = "languages" | "ai" | "ml" | "data" | "ops" | "engineering" | "foundations" | "other" | "suggested";

export const CLUSTERS: Record<ClusterKey, { label: string; hex: string; soft: string }> = {
  languages: { label: "Languages", hex: "#8b5cf6", soft: "bg-violet-50/70 border-violet-200/70 dark:bg-violet-500/10 dark:border-violet-400/20" },
  ai: { label: "LLMs & language AI", hex: "#ec4899", soft: "bg-pink-50/70 border-pink-200/70 dark:bg-pink-500/10 dark:border-pink-400/20" },
  ml: { label: "ML & vision", hex: "#d946ef", soft: "bg-fuchsia-50/70 border-fuchsia-200/70 dark:bg-fuchsia-500/10 dark:border-fuchsia-400/20" },
  data: { label: "Data & databases", hex: "#0ea5e9", soft: "bg-sky-50/70 border-sky-200/70 dark:bg-sky-500/10 dark:border-sky-400/20" },
  ops: { label: "MLOps, cloud & tools", hex: "#14b8a6", soft: "bg-teal-50/70 border-teal-200/70 dark:bg-teal-500/10 dark:border-teal-400/20" },
  engineering: { label: "Software engineering", hex: "#3b82f6", soft: "bg-blue-50/70 border-blue-200/70 dark:bg-blue-500/10 dark:border-blue-400/20" },
  foundations: { label: "Foundations", hex: "#f59e0b", soft: "bg-amber-50/70 border-amber-200/70 dark:bg-amber-500/10 dark:border-amber-400/20" },
  other: { label: "Other", hex: "#64748b", soft: "bg-slate-50/70 border-slate-200/70 dark:bg-slate-500/10 dark:border-slate-400/20" },
  suggested: { label: "Suggested to explore", hex: "#94a3b8", soft: "bg-transparent border-dashed border-border" },
};

/** The engine's catalogue categories (worker/skills_catalog.py), grouped for display. */
const CATEGORY_TO_CLUSTER: Record<string, ClusterKey> = {
  language: "languages",
  llm: "ai",
  nlp: "ai",
  speech: "ai",
  ml_framework: "ml",
  cv: "ml",
  graph: "ml",
  robotics: "ml",
  data: "data",
  database: "data",
  mlops: "ops",
  cloud: "ops",
  edge: "ops",
  tool: "ops",
  backend: "engineering",
  frontend: "engineering",
  concept: "foundations",
};

/** Suggested skills always sit apart: the engine gives them no category and no evidence of their own. */
export function clusterOf(node: Pick<SkillGraphNode, "category" | "status">): ClusterKey {
  if (node.status === "inferred") return "suggested";
  return CATEGORY_TO_CLUSTER[node.category?.toLowerCase()] ?? "other";
}

export type Cluster = { key: ClusterKey; nodes: SkillGraphNode[] };

const CLUSTER_ORDER = Object.keys(CLUSTERS) as ClusterKey[];

/** Clusters in a stable order, larger first; the suggested group always last. */
export function skillClusters(nodes: SkillGraphNode[]): Cluster[] {
  const map = new Map<ClusterKey, SkillGraphNode[]>();
  for (const n of nodes) map.set(clusterOf(n), [...(map.get(clusterOf(n)) ?? []), n]);
  return [...map.entries()]
    .map(([key, ns]) => ({ key, nodes: ns }))
    .sort((a, b) => Number(a.key === "suggested") - Number(b.key === "suggested") || b.nodes.length - a.nodes.length || CLUSTER_ORDER.indexOf(a.key) - CLUSTER_ORDER.indexOf(b.key));
}

/** Only edges whose two ends are both on screen; nothing is drawn to a skill that isn't there. */
export function visibleEdges(graph: SkillGraphData | undefined, ids: Set<string>): SkillGraphEdge[] {
  if (!graph) return [];
  return graph.edges.filter((e) => e.source !== e.target && ids.has(e.source) && ids.has(e.target));
}

export const EVIDENCE_KIND: Record<string, { label: string; hex: string }> = {
  repository: { label: "GitHub repositories", hex: "#0ea5e9" },
  project: { label: "Projects", hex: "#14b8a6" },
  experience: { label: "Work experience", hex: "#8b5cf6" },
  certification: { label: "Certifications", hex: "#f59e0b" },
  assessment: { label: "Assessments", hex: "#10b981" },
  platform: { label: "Platform activity", hex: "#6366f1" },
  claim: { label: "Your skills list", hex: "#94a3b8" },
};
export const evidenceKind = (kind: string) => EVIDENCE_KIND[kind] ?? { label: kind.charAt(0).toUpperCase() + kind.slice(1), hex: "#64748b" };

/** How much of each kind of evidence backs the skills on screen: real counts of recorded evidence items. */
export function evidenceMix(nodes: SkillGraphNode[]): { kind: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const n of nodes) for (const e of n.evidence) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return [...counts.entries()].map(([kind, count]) => ({ kind, count })).sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind));
}

export function groupEvidence(evidence: SkillEvidenceRef[]): { kind: string; items: SkillEvidenceRef[] }[] {
  const map = new Map<string, SkillEvidenceRef[]>();
  for (const e of evidence) map.set(e.kind, [...(map.get(e.kind) ?? []), e]);
  return [...map.entries()].map(([kind, items]) => ({ kind, items }));
}

const list = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? "") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`);

/** Why the engine identified this skill, in plain words, from what it actually recorded. */
export function whyIdentified(node: SkillGraphNode): string {
  if (node.status === "inferred") {
    return node.inferredFrom.length
      ? `Suggested because it usually goes with ${list(node.inferredFrom)}, which your evidence shows. It's a pointer to explore, not a skill we've seen you use.`
      : "Suggested from related skills. It's a pointer to explore, not a skill we've seen you use.";
  }
  const kinds = [...new Set(node.evidence.map((e) => e.kind))].filter((k) => k !== "claim").map((k) => evidenceKind(k).label.toLowerCase());
  if (node.status === "verified") {
    return kinds.length ? `Verified from your ${list(kinds)}: work that shows the skill, not only a mention of it.` : "Verified from independent evidence on your profile.";
  }
  return node.proficiency === null
    ? "You listed this skill. Nothing independent shows it yet, so it isn't scored."
    : "Rests only on your own descriptions, so its score is capped until a repository, assessment or other independent source shows it.";
}

/** Confidence wording from the engine's number, which counts independent kinds of source. */
export function confidenceLabel(confidence: number): "Low" | "Medium" | "High" {
  return confidence >= 0.8 ? "High" : confidence >= 0.6 ? "Medium" : "Low";
}

export const RELATIONSHIP_LABEL: Record<string, string> = {
  used_together: "Used together in your work",
  requires: "Requires",
  built_on: "Built on",
  implements: "Implements",
  subdomain_of: "Part of",
  prerequisite: "Prerequisite",
  extends: "Extends",
  enables: "Enables",
  relates_to: "Related",
};
