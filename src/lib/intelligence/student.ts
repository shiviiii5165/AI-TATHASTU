import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { GithubContributionDay } from "@/db/schema";
import type { IntelligenceDoc, ProfileViewDoc } from "@/lib/dashboard/types";
import { careerRoleLabel } from "@/lib/onboarding/catalog";

type Row = Record<string, unknown>;

export interface FactEntry {
  key: string;
  origin: string;
  confirmation: string;
  fields: Record<string, string>;
  createdAt: string;
}

export interface TimelineEvent {
  at: string;
  kind: "account" | "evidence" | "learning" | "credential" | "career" | "code" | "connection";
  title: string;
  detail?: string;
  source: string;
  verification: "verified" | "external" | "self_reported" | "engine";
}

export interface Student360 {
  user: Row & { id: string; name: string | null; email: string | null };
  institution: string | null;
  goal: { role: string | null; label: string | null; other: string | null; priorities: string[] };
  view: ProfileViewDoc | null;
  viewUpdatedAt: string | null;
  intel: IntelligenceDoc | null;
  admin: { basis: string | null; unreviewedFacts: number; onboardingComplete: boolean | null; projects: { total: number; matched: number } | null };
  eris: { role: string; label: string; score: number; computedAt: string; components: Record<string, number | null> }[];
  connections: { source: string; status: string; lastSyncAt: string | null; staleAfter: string | null }[];
  github: { total: number | null; days: GithubContributionDay[]; syncedAt: string | null; login: string | null; totals: Record<string, number> | null } | null;
  repos: { name: string; url: string | null; stars: number; languages: Record<string, number>; lastCommitAt: string | null; impact: number | null; rationale: string | null }[];
  projects: { title: string; technologies: string[]; status: string; confidence: number; start: string | null; end: string | null }[];
  facts: Record<string, FactEntry[]>;
  learning: { kind: string; title: string; provider: string | null; status: string; verification: string; url: string | null; completedAt: string | null; createdAt: string; skills: string[] }[];
  milestones: { skill: string; role: string; url: string; createdAt: string }[];
  opportunities: { title: string; organization: string; kind: string; at: string }[];
  integrations: { client: string; linkedAt: string | null; revokedAt: string | null; scopes: Record<string, boolean> }[];
  timeline: TimelineEvent[];
}

/** view.admin, written by worker/intelligence/compute.py (admin_assessment). */
interface AdminView {
  basis?: "reviewed" | "includes_unreviewed";
  unreviewedFacts?: number;
  onboardingComplete?: boolean;
  intelligence?: Partial<IntelligenceDoc>;
  eris?: Record<string, number>;
  projects?: { total: number; matched: number };
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export async function loadStudent360(userId: string): Promise<Student360 | null> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return null;
  const { rows: users } = await db.execute(sql`
    SELECT u.id::text AS id, u.name, u.email, u.avatar_url AS image, u.role, u.university, u.degree, u.specialization,
           coalesce(u.current_academic_year, u.academic_year) AS "academicYear", u.expected_graduation_year AS "graduationYear",
           u.city, u.country, u.created_at AS "createdAt", u.deleted_at AS "deletedAt", i.canonical_name AS institution,
           os.career_role AS "careerRole", os.career_role_other AS "careerRoleOther", os.priorities, os.resume_uploaded AS "resumeUploaded"
    FROM users u
    LEFT JOIN institutions i ON i.id = u.institution_id
    LEFT JOIN onboarding_state os ON os.user_id = u.id
    WHERE u.id = ${userId}::uuid`);
  const u = (users as Row[])[0];
  if (!u) return null;

  const [view, eris, conns, gh, repos, projects, facts, learning, milestones, opps, integ] = await Promise.all([
    db.execute(sql`SELECT view, updated_at FROM profile_views WHERE user_id = ${userId}::uuid`),
    db.execute(sql`SELECT role, score, breakdown_json AS b, computed_at FROM eris_scores WHERE user_id = ${userId}::uuid ORDER BY score DESC`),
    db.execute(sql`SELECT source_id, status, last_sync_at, stale_after FROM connections WHERE user_id = ${userId}::uuid ORDER BY source_id`),
    db.execute(sql`SELECT total_contributions, days, synced_at, github_login, category_totals FROM github_contributions WHERE user_id = ${userId}::uuid`),
    db.execute(sql`SELECT r.repo_name, r.url, r.stars, r.languages, r.last_commit_at, s.impact_score, s.rationale
      FROM code_repositories r LEFT JOIN github_scores s ON s.user_id = r.user_id AND s.repo_name = r.repo_name
      WHERE r.user_id = ${userId}::uuid ORDER BY s.impact_score DESC NULLS LAST, r.stars DESC, r.last_commit_at DESC NULLS LAST LIMIT 30`),
    db.execute(sql`SELECT canonical_title, technologies, status, match_confidence, timeline_start, timeline_end FROM unified_projects WHERE user_id = ${userId}::uuid ORDER BY timeline_end DESC NULLS LAST`),
    db.execute(sql`SELECT field_group, field_name, coalesce(record_key, id::text) AS rk, origin, confirmation, coalesce(normalized_value, extracted_value) AS v, created_at
      FROM profile_facts WHERE user_id = ${userId}::uuid AND superseded_by IS NULL AND confirmation <> 'rejected'
        AND field_group IN ('education', 'experience', 'certifications', 'publications', 'achievements', 'projects')
      ORDER BY created_at`),
    db.execute(sql`SELECT kind, title, provider, status, verification, url, completed_at, created_at, skills FROM learning_records WHERE user_id = ${userId}::uuid AND deleted_at IS NULL ORDER BY coalesce(completed_at, created_at) DESC`),
    db.execute(sql`SELECT skill, role, evidence_url, created_at FROM roadmap_milestone_submissions WHERE user_id = ${userId}::uuid ORDER BY created_at DESC LIMIT 50`),
    db.execute(sql`SELECT o.title, o.organization, i.kind, i.created_at FROM opportunity_interactions i JOIN opportunities o ON o.id = i.opportunity_id
      WHERE i.user_id = ${userId}::uuid AND i.kind IN ('opened_application', 'confirmed_applied') ORDER BY i.created_at DESC LIMIT 50`),
    db.execute(sql`SELECT client_id, linked_at, revoked_at, scopes FROM integration_consents WHERE user_id = ${userId}::uuid`),
  ]);

  const v = (view.rows as Row[])[0];
  const doc = (v?.view ?? null) as (ProfileViewDoc & { admin?: AdminView }) | null;

  const grouped: Record<string, Map<string, FactEntry>> = {};
  for (const f of facts.rows as Row[]) {
    const g = String(f.field_group);
    const map = (grouped[g] ??= new Map());
    const key = `${f.origin}:${f.rk}`;
    const e = map.get(key) ?? { key, origin: String(f.origin), confirmation: String(f.confirmation), fields: {}, createdAt: iso(f.created_at)! };
    const val = f.v;
    e.fields[String(f.field_name)] = typeof val === "string" ? val : Array.isArray(val) ? val.join(", ") : val === null || val === undefined ? "" : typeof val === "object" ? JSON.stringify(val) : String(val);
    map.set(key, e);
  }
  const factsOut = Object.fromEntries(Object.entries(grouped).map(([g, m]) => [g, [...m.values()]]));

  const g = (gh.rows as Row[])[0];
  const out: Student360 = {
    user: u as Student360["user"],
    institution: (u.institution as string) ?? (u.university as string) ?? null,
    goal: {
      role: (u.careerRole as string) ?? null,
      label: u.careerRole ? careerRoleLabel(String(u.careerRole)) ?? String(u.careerRole) : null,
      other: (u.careerRoleOther as string) ?? null,
      priorities: Array.isArray(u.priorities) ? (u.priorities as string[]) : [],
    },
    view: doc,
    viewUpdatedAt: iso(v?.updated_at),
    // Admins see the fuller picture when the worker built one (it includes resume facts awaiting review).
    intel: (doc?.admin?.intelligence as IntelligenceDoc | undefined) ?? doc?.intelligence ?? null,
    admin: {
      basis: doc?.admin?.basis ?? (doc?.intelligence ? "reviewed" : null),
      unreviewedFacts: doc?.admin?.unreviewedFacts ?? 0,
      onboardingComplete: doc?.admin?.onboardingComplete ?? null,
      projects: doc?.admin?.projects ?? null,
    },
    eris: (eris.rows as Row[]).map((r) => ({
      role: String(r.role), label: careerRoleLabel(String(r.role)) ?? String(r.role), score: Number(r.score) * 100, computedAt: iso(r.computed_at)!,
      components: ((r.b as Row)?.components ?? {}) as Record<string, number | null>,
    })),
    connections: (conns.rows as Row[]).map((r) => ({ source: String(r.source_id), status: String(r.status), lastSyncAt: iso(r.last_sync_at), staleAfter: iso(r.stale_after) })),
    github: g ? { total: g.total_contributions === null ? null : Number(g.total_contributions), days: (g.days as GithubContributionDay[]) ?? [], syncedAt: iso(g.synced_at), login: (g.github_login as string) ?? null, totals: (g.category_totals as Record<string, number>) ?? null } : null,
    repos: (repos.rows as Row[]).map((r) => ({ name: String(r.repo_name), url: (r.url as string) ?? null, stars: Number(r.stars) || 0, languages: (r.languages as Record<string, number>) ?? {}, lastCommitAt: iso(r.last_commit_at), impact: r.impact_score === null ? null : Number(r.impact_score), rationale: (r.rationale as string) ?? null })),
    projects: (projects.rows as Row[]).map((r) => ({ title: String(r.canonical_title), technologies: (r.technologies as string[]) ?? [], status: String(r.status), confidence: Number(r.match_confidence) || 0, start: (r.timeline_start as string) ?? null, end: (r.timeline_end as string) ?? null })),
    facts: factsOut,
    learning: (learning.rows as Row[]).map((r) => ({ kind: String(r.kind), title: String(r.title), provider: (r.provider as string) ?? null, status: String(r.status), verification: String(r.verification), url: (r.url as string) ?? null, completedAt: iso(r.completed_at), createdAt: iso(r.created_at)!, skills: (r.skills as string[]) ?? [] })),
    milestones: (milestones.rows as Row[]).map((r) => ({ skill: String(r.skill), role: String(r.role), url: String(r.evidence_url), createdAt: iso(r.created_at)! })),
    opportunities: (opps.rows as Row[]).map((r) => ({ title: String(r.title), organization: String(r.organization), kind: String(r.kind), at: iso(r.created_at)! })),
    integrations: (integ.rows as Row[]).map((r) => ({ client: String(r.client_id), linkedAt: iso(r.linked_at), revokedAt: iso(r.revoked_at), scopes: (r.scopes as Record<string, boolean>) ?? {} })),
    timeline: [],
  };
  // Goals scored only in the admin view (they rest on resume facts awaiting review) are added, marked as such.
  for (const [role, score] of Object.entries(doc?.admin?.eris ?? {})) {
    if (!out.eris.some((e) => e.role === role))
      out.eris.push({ role, label: `${careerRoleLabel(role) ?? role} (incl. unreviewed facts)`, score: score * 100, computedAt: out.viewUpdatedAt ?? "", components: {} });
  }
  out.timeline = buildTimeline(out);
  return out;
}

/** One chronological list from the dated records above. Only events with a real timestamp; nothing synthesised. */
function buildTimeline(s: Student360): TimelineEvent[] {
  const ev: TimelineEvent[] = [];
  if (s.user.createdAt) ev.push({ at: iso(s.user.createdAt)!, kind: "account", title: "Joined AI Tathastu", source: "AI Tathastu", verification: "verified" });
  for (const c of s.connections) if (c.lastSyncAt) ev.push({ at: c.lastSyncAt, kind: "connection", title: `${c.source} synced`, detail: `Status: ${c.status}`, source: c.source, verification: "verified" });
  for (const l of s.learning) {
    if (l.completedAt) ev.push({ at: l.completedAt, kind: l.kind === "certification" ? "credential" : "learning", title: `${l.kind === "certification" ? "Certification" : "Course"} completed: ${l.title}`, detail: l.provider ?? undefined, source: "AI Tathastu learning", verification: l.verification === "verified" ? "verified" : "self_reported" });
    else ev.push({ at: l.createdAt, kind: "learning", title: `${l.kind === "certification" ? "Certification" : "Course"} ${l.status}: ${l.title}`, detail: l.provider ?? undefined, source: "AI Tathastu learning", verification: "self_reported" });
  }
  for (const m of s.milestones) ev.push({ at: m.createdAt, kind: "evidence", title: `Milestone evidence submitted: ${m.skill}`, detail: m.url, source: "AI Tathastu roadmap", verification: "self_reported" });
  for (const o of s.opportunities) ev.push({ at: o.at, kind: "career", title: `${o.kind === "confirmed_applied" ? "Confirmed applying" : "Opened application"}: ${o.title}`, detail: o.organization, source: "AI Tathastu opportunities", verification: "self_reported" });
  for (const r of s.repos) if (r.lastCommitAt) ev.push({ at: r.lastCommitAt, kind: "code", title: `Last commit to ${r.name}`, source: "GitHub", verification: "verified" });
  for (const i of s.integrations) {
    if (i.linkedAt) ev.push({ at: i.linkedAt, kind: "connection", title: `Linked ${i.client}`, source: i.client, verification: "verified" });
    if (i.revokedAt) ev.push({ at: i.revokedAt, kind: "connection", title: `Disconnected ${i.client}`, source: i.client, verification: "verified" });
  }
  if (s.intel?.computedAt) ev.push({ at: s.intel.computedAt, kind: "evidence", title: "Intelligence recomputed", detail: `${s.intel.skills.length} skills assessed`, source: "Career engine", verification: "engine" });
  return ev.filter((e) => !Number.isNaN(Date.parse(e.at))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
