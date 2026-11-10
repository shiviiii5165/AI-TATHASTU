// Client-safe catalogue data for the onboarding wizard.

import registry from "../../../worker/intelligence/frameworks/career_roles.json";

/**
 * Career directions offered in onboarding ("What do you want to do?"), from the canonical registry
 * (worker/intelligence/frameworks/career_roles.json), which the worker's intelligence engine reads too, so the web
 * app and the engine can't disagree on ids or labels. Ids are stable storage keys: a role is retired, never renamed.
 * `keywords` only widen search; they are never shown.
 */
export type CareerRole = { id: string; label: string; blurb: string; keywords: string };

const toRole = ({ id, label, blurb, keywords }: CareerRole): CareerRole => ({ id, label, blurb, keywords });

/** The 20 current pathways, in registry order. */
export const CAREER_ROLES: readonly CareerRole[] = registry.roles.filter((r) => r.status === "current").map(toRole);

/**
 * Retired directions: no longer offered, but still valid so existing saved choices load, validate
 * and display unchanged (never silently rewritten).
 */
export const RETIRED_CAREER_ROLES: readonly CareerRole[] = registry.roles.filter((r) => r.status === "retired").map(toRole);

export const ALL_CAREER_ROLES: readonly CareerRole[] = [...CAREER_ROLES, ...RETIRED_CAREER_ROLES];

export type CareerRoleId = string;
/** Every id that may be stored (offered + retired). */
export const CAREER_ROLE_IDS = ALL_CAREER_ROLES.map((r) => r.id) as [CareerRoleId, ...CareerRoleId[]];
/** Display label for any stored role id (offered or retired); unknown ids are returned as-is. */
export const careerRoleLabel = (id: string | null | undefined) =>
  id ? (ALL_CAREER_ROLES.find((r) => r.id === id)?.label ?? id) : null;

/** Case-insensitive search over label, description and keywords. */
export function searchCareerRoles(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [...CAREER_ROLES];
  const terms = q.split(/\s+/);
  return CAREER_ROLES.filter((r) => {
    const hay = `${r.label} ${r.blurb} ${r.keywords}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// Ids match the `requiredIntent` values used by the widget registry.
export const PRIORITIES = [
  { id: "learn_ai_ml", label: "Learn AI & ML", blurb: "Structured learning paths and skill gaps", module: "Learn" },
  { id: "avasar_jobs", label: "Internships & Jobs", blurb: "Roles that fit your profile", module: "Avasar" },
  { id: "people_mentors", label: "People & Mentors", blurb: "Mentors and peers in your field", module: "Collaborate" },
  { id: "collaborate", label: "Collaborate", blurb: "Join teams and open projects", module: "Collaborate" },
  { id: "build_projects", label: "Build Projects", blurb: "Portfolio projects matched to your goal", module: "Projects" },
  { id: "research_events", label: "Research & Events", blurb: "Papers, conferences, competitions", module: "Meet" },
] as const;

export type PriorityId = (typeof PRIORITIES)[number]["id"];
export const PRIORITY_IDS = PRIORITIES.map((p) => p.id) as [PriorityId, ...PriorityId[]];
export const MAX_PRIORITIES = 3;
