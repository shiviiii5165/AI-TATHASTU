import "server-only";

import { and, count, eq, inArray, isNull, ne, or } from "drizzle-orm";

import { db } from "@/db";
import {
  codeRepositories,
  connections,
  onboardingState,
  profileFacts,
  profileViews,
  unifiedProjects,
  users,
  type FactOrigin,
  type OnboardingState,
  type ProfileFact,
  type User,
} from "@/db/schema";
import type { ProfileViewDoc } from "@/lib/dashboard/types";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";
import { factDisplayValue } from "@/lib/profile/display";

/**
 * One read model for "the user's profile", used by /profile (which shows
 * provenance) and /api/profile/v1/me (which maps it to the public contract).
 * Usable facts = confirmed or edited by the user, plus facts from API sources
 * (GitHub, Kaggle…) the user hasn't rejected; the same rule as the worker.
 */

export const API_ORIGINS: FactOrigin[] = [
  "github",
  "kaggle",
  "stack_exchange",
  "portfolio",
  "leetcode",
  "hackerrank",
  "linkedin_scrape",
];

/** WHERE clause for the user's usable, current facts (the rule above). */
export function usableFactsOf(userId: string) {
  return and(
    eq(profileFacts.userId, userId),
    isNull(profileFacts.supersededBy),
    or(
      inArray(profileFacts.confirmation, ["confirmed", "edited"]),
      and(inArray(profileFacts.origin, API_ORIGINS), ne(profileFacts.confirmation, "rejected")),
    ),
  )!;
}

export type Fact = {
  id: string;
  group: string;
  field: string;
  recordKey: string | null;
  value: string;
  origin: FactOrigin;
  confirmation: ProfileFact["confirmation"];
  evidence: string | null;
  page: number | null;
};

export type Entry = { key: string; origins: FactOrigin[]; fields: Record<string, Fact> };

export type ProjectView = {
  title: string;
  status: string;
  matchConfidence: number;
  technologies: string[];
  origins: FactOrigin[];
  links: string[];
  descriptions: string[];
};

export type ProfileData = Awaited<ReturnType<typeof loadProfile>>;

// Which source wins when several give the same identity field.
const PRECEDENCE: Partial<Record<FactOrigin, number>> = { user_entered: 4, resume: 3 };
const rank = (f: Fact) => (PRECEDENCE[f.origin] ?? 2) + (f.confirmation === "edited" ? 0.5 : 0);

/**
 * `known`: the user and onboarding rows the caller's auth guard already read,
 * so they aren't fetched twice in one request.
 */
export async function loadProfile(userId: string, known?: { user: User; state: OnboardingState }) {
  const [[user], [state], [viewRow], factRows, repos, projects, [connCount]] = await Promise.all([
    known ? [known.user] : db.select().from(users).where(eq(users.id, userId)),
    known ? [known.state] : db.select().from(onboardingState).where(eq(onboardingState.userId, userId)),
    db.select().from(profileViews).where(eq(profileViews.userId, userId)),
    db.select().from(profileFacts).where(usableFactsOf(userId)),
    db.select().from(codeRepositories).where(eq(codeRepositories.userId, userId)),
    db.select().from(unifiedProjects).where(eq(unifiedProjects.userId, userId)),
    db.select({ n: count() }).from(connections).where(eq(connections.userId, userId)),
  ]);

  const facts: Fact[] = factRows.map((f) => ({
    id: f.id,
    group: f.fieldGroup,
    field: f.fieldName,
    recordKey: f.recordKey,
    value: factDisplayValue(f.normalizedValue ?? f.extractedValue),
    origin: f.origin,
    confirmation: f.confirmation,
    evidence: f.sourceEvidence,
    page: f.location?.page ?? null,
  }));
  const view = (viewRow?.view as ProfileViewDoc | undefined) ?? null;

  // ── Identity & contact: best value per field, plus differing alternates ──
  const identity: Record<string, { best: Fact; others: Fact[] }> = {};
  for (const f of facts.filter((f) => f.group === "identity" || f.group === "contact")) {
    const slot = identity[f.field];
    if (!slot) identity[f.field] = { best: f, others: [] };
    else if (rank(f) > rank(slot.best)) identity[f.field] = { best: f, others: [slot.best, ...slot.others] };
    else slot.others.push(f);
  }
  for (const slot of Object.values(identity)) {
    const norm = (v: string) => v.trim().toLowerCase();
    slot.others = slot.others.filter((o, i, all) => norm(o.value) !== norm(slot.best.value) && all.findIndex((x) => norm(x.value) === norm(o.value)) === i);
  }

  // ── Repeatable groups as entries (one per record_key) ───────────────────
  const entriesOf = (group: string): Entry[] => {
    const byKey = new Map<string, Entry>();
    for (const f of facts.filter((f) => f.group === group)) {
      const key = `${f.origin}:${f.recordKey ?? f.id}`;
      const e = byKey.get(key) ?? { key, origins: [], fields: {} };
      e.fields[f.field] = f;
      if (!e.origins.includes(f.origin)) e.origins.push(f.origin);
      byKey.set(key, e);
    }
    return [...byKey.values()].sort((a, b) => latestYear(b) - latestYear(a));
  };

  // ── Projects: unified_projects, enriched from their source facts ───────
  const factById = new Map(facts.map((f) => [f.id, f]));
  const repoByName = new Map(repos.map((r) => [r.repoName, r]));
  const projectViews: ProjectView[] = projects
    .map((p) => {
      const sources = p.sourceFactIds.map((id) => factById.get(id)).filter((f): f is Fact => Boolean(f));
      const links = new Set<string>();
      const descriptions = new Set<string>();
      for (const f of sources) {
        if (f.field === "url") links.add(f.value.startsWith("http") ? f.value : `https://${f.value}`);
        if (f.field === "description") descriptions.add(f.value);
        const repo = f.origin === "github" && f.recordKey ? repoByName.get(f.recordKey) : undefined;
        if (repo?.url) links.add(repo.url);
      }
      return {
        title: p.canonicalTitle,
        status: p.status,
        matchConfidence: p.matchConfidence,
        technologies: p.technologies,
        origins: [...new Set(sources.map((f) => f.origin))],
        links: [...links],
        descriptions: [...descriptions],
      };
    })
    .sort((a, b) => Number(b.status === "matched") - Number(a.status === "matched") || a.title.localeCompare(b.title));

  // ── Skills: the worker's canonical summary when available ──────────────
  const skills =
    view?.skills ??
    dedupe(facts.filter((f) => f.group === "skills")).map((f) => ({
      name: f.value,
      category: "other",
      evidenceStrength: 0,
      sources: [f.origin],
      verificationStatus: f.confirmation === "unconfirmed" ? "self_reported" : "verified",
    }));

  return {
    user,
    state,
    view,
    facts,
    identity,
    experience: entriesOf("experience"),
    education: entriesOf("education"),
    projects: projectViews,
    skills,
    repos,
    connectorsCount: connCount?.n ?? 0,
  };
}

function dedupe(facts: Fact[]) {
  const seen = new Set<string>();
  return facts.filter((f) => !seen.has(f.value.toLowerCase()) && seen.add(f.value.toLowerCase()));
}

/** Sort key: latest year mentioned in the entry's dates ("Present" sorts first). */
function latestYear(e: Entry): number {
  const text = [e.fields.end_date?.value, e.fields.start_date?.value].filter(Boolean).join(" ");
  if (/present|current|now|ongoing/i.test(text)) return 9999;
  const years = text.match(/(19|20)\d\d/g)?.map(Number) ?? [];
  return years.length ? Math.max(...years) : 0;
}

export const dateRange = (e: Entry) => {
  const start = e.fields.start_date?.value;
  const end = e.fields.end_date?.value;
  return start || end ? [start, end].filter(Boolean).join(" – ") : null;
};

// ─── Public contract: GET /api/profile/v1/me ───────────────────────────────
// Shape fixed by the Implementation Plan §4.1 and public/api/profile/openapi.json.
// Contact details (email, phone) are deliberately not part of it.

export function toProfileV1(p: ProfileData) {
  const best = (field: string) => p.identity[field]?.best.value ?? null;
  return {
    identity: {
      name: best("full_name") ?? p.user.name,
      headline: best("headline"),
      university: p.user.university ?? p.education[0]?.fields.institution?.value ?? null,
      degree: p.user.degree ?? p.education[0]?.fields.degree?.value ?? null,
      career_role: p.state?.careerRole ?? null,
    },
    skills: p.skills.map((s) => ({
      name: s.name,
      category: s.category,
      evidenceStrength: s.evidenceStrength,
      verificationStatus: s.verificationStatus,
    })),
    projects: p.projects.map((pr) => ({
      canonicalTitle: pr.title,
      technologies: pr.technologies,
      links: pr.links,
      contributions: pr.descriptions,
    })),
    experience: p.experience.map((e) => ({
      org: e.fields.organization?.value ?? null,
      role: e.fields.role?.value ?? null,
      dateRange: dateRange(e),
      responsibilities: e.fields.description
        ? e.fields.description.value.split(/\n|•|;\s/).map((s) => s.trim()).filter(Boolean)
        : [],
    })),
    education: p.education.map((e) => ({
      institution: e.fields.institution?.value ?? null,
      degree: [e.fields.degree?.value, e.fields.field_of_study?.value].filter(Boolean).join(", ") || null,
      dates: dateRange(e),
      grade: e.fields.grade?.value ?? null,
    })),
    erisScore: {
      overall: p.view?.erisScore.overall ?? null,
      byRole: p.view?.erisScore.byRole ?? {},
      gaps: p.view?.erisScore.gaps ?? [],
    },
    readinessIndicators: {
      profileComplete: p.view?.readinessIndicators.profileComplete ?? null,
      resumeLinked: p.facts.some((f) => f.origin === "resume"),
      connectorsCount: p.connectorsCount,
    },
    goals: {
      primaryRole: p.state?.careerRole ?? null,
      priorities: p.state?.priorities ?? [],
    },
  };
}

export type ProfileV1 = ReturnType<typeof toProfileV1>;

// ─── Embed projection (pilot site, scoped token) ───────────────────────────
// Plan §4.2: the embed shows a compact card and never receives private
// fields, so it gets this minimal view instead of the full contract.

export function toEmbedV1(p: ProfileData, appUrl: string) {
  return {
    name: p.identity.full_name?.best.value ?? p.user.name ?? null,
    // Display label ("ML Engineer"), not the internal id.
    careerRole: CAREER_ROLES.find((r) => r.id === p.state?.careerRole)?.label ?? p.state?.careerRoleOther ?? null,
    erisScore: p.view?.erisScore.overall ?? null,
    topSkills: p.skills.slice(0, 3).map((s) => s.name),
    dashboardUrl: `${appUrl}/dashboard`,
  };
}

export type EmbedV1 = ReturnType<typeof toEmbedV1>;
