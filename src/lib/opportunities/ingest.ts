/**
 * Research opportunity ingestion from the curated source registry (opportunity_sources).
 *
 *   refreshSource   fetches ONE registered, enabled, terms-reviewed feed, at most once per its
 *                   min_fetch_interval, after checking robots.txt. Failures only record last_error:
 *                   existing listings are never replaced or deleted because a fetch failed.
 *   addCuratedListing  an operator-entered listing from a 'manual' source (official page they checked).
 *   applyLifecycle  expires past deadlines and demotes listings whose verification went stale.
 *
 * Deduplication: (source_id, external_id) within a source, canonical URL across all sources.
 * Status rules: a feed entry is 'active' only for an auto_verify source (operator trusts it to list
 * vacancies), otherwise 'unverified' until reviewed. An entry the source stops listing becomes
 * 'withdrawn'. Rows are never deleted, so audit history and any user references survive.
 */
import { and, eq, inArray, isNotNull, lt, or, sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

import type * as schema from "@/db/schema";
import { opportunities, opportunitySources, type OpportunitySource } from "@/db/schema";

import { canonicalUrl } from "./canonical";
import { parseFeed } from "./feed";

export type OppDb = PgDatabase<PgQueryResultHKT, typeof schema>;

/** A listing older than this without re-verification is no longer recommended. */
export const VERIFICATION_TTL_DAYS = 30;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_BODY_BYTES = 2_000_000;
const USER_AGENT = "AITathastu-OpportunityBot/1.0 (+https://www.aitathastu.com)";

export type RefreshOutcome =
  | { status: "skipped"; reason: "disabled" | "manual_source" | "interval" | "terms_not_reviewed" | "not_approved" | "backoff" | "locked" }
  | { status: "failed"; error: string }
  | { status: "ok"; seen: number; inserted: number; updated: number; withdrawn: number; duplicates: number; filtered?: number };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

async function timedFetch(fetchImpl: Fetch, url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml;q=0.8, text/html;q=0.7" }, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(t);
  }
}

/** Minimal robots.txt check for the "*" group (and our agent): longest matching Allow/Disallow wins. */
export function robotsAllows(robotsTxt: string, path: string): boolean {
  type Group = { agents: string[]; rules: { allow: boolean; prefix: string }[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();
    if (key === "user-agent") {
      if (!current || !lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((key === "allow" || key === "disallow") && current) {
      if (value) current.rules.push({ allow: key === "allow", prefix: value.replace(/\*$/, "") });
      lastWasAgent = false;
    }
  }
  const ours = groups.filter((g) => g.agents.some((a) => a.includes("aitathastu")));
  const applicable = ours.length ? ours : groups.filter((g) => g.agents.includes("*"));
  const hits = applicable.flatMap((g) => g.rules).filter((r) => path.startsWith(r.prefix)).sort((a, b) => b.prefix.length - a.prefix.length);
  return hits.length === 0 || hits[0]!.allow;
}

async function recordSource(db: OppDb, id: string, values: Partial<typeof opportunitySources.$inferInsert>) {
  await db.update(opportunitySources).set(values).where(eq(opportunitySources.id, id));
}

/** Errors are stored as short codes only: never response bodies, tokens or payloads. */
const errorCode = (e: unknown) => (e instanceof Error ? e.message : String(e)).replace(/\s+/g, " ").slice(0, 120);

export interface Candidate {
  externalId: string;
  title: string;
  url: string | null;
  description: string | null;
  publishedAt: Date | null;
  researchGroup: string | null;
  deadline: string | null;
  deadlineAt: Date | null;
  statusHint: "open" | "closed" | null;
  rolling: boolean;
}

/** VERIFIED / NEEDS_REVIEW / REJECTED, as stored statuses (active / unverified / expired). */
export function decideStatus(source: Pick<OpportunitySource, "kind" | "autoVerify">, c: Candidate, now: Date): { status: "active" | "unverified" | "expired"; reason: string | null } {
  if (c.statusHint === "closed") return { status: "expired", reason: "Marked closed by the source" };
  if (c.deadlineAt && c.deadlineAt.getTime() <= now.getTime()) return { status: "expired", reason: "Application deadline has passed" };
  if (!source.autoVerify) return { status: "unverified", reason: "Awaiting review: source is not auto-verified" };
  if (source.kind === "page_monitor" && !(c.statusHint === "open" || c.deadlineAt || c.rolling)) {
    return { status: "unverified", reason: "The source shows no deadline or open status for this listing" };
  }
  return { status: "active", reason: null };
}

// Order matters: "Junior Research Fellow (JRF)" is a project research position, not a fellowship programme.
const KIND_RULES: [RegExp, string][] = [
  [/\b(jrf|srf|junior research fellow|senior research fellow|research (associate|assistant)|project (associate|assistant|scientist|fellow|trainee))\b/i, "research_assistant"],
  [/post-?doc/i, "fellowship"], // before PhD: "postdoctoral" contains "doctoral"
  [/\bph\.?\s?d\b|\bdoctoral\b|\bdoctorate\b/i, "phd_position"],
  [/fellowship|\bfellows?\b/i, "fellowship"],
  [/\bintern(ship)?\b/i, "research_internship"],
];
/** Opportunity category from the title words only; null when the title doesn't say. */
export const kindFromTitle = (title: string) => KIND_RULES.find(([re]) => re.test(title))?.[1] ?? null;

// ── Research classification (title + description + source context, not title keywords alone) ──
const RESEARCH_TITLE = /\b(ph\.?\s?d|doctoral|doktorand|post-?doc|research|scientist|fellow|\bjrf\b|\bsrf\b|project (associate|assistant|scientist|trainee|fellow)|intern(ship)?|visiting student|summer (research|school|programme|program)|winter (research|school))/i;
const NON_RESEARCH_TITLE = /\b(admin(istrative)?|accountant|accounts|clerk|driver|attendant|coordinator|manager|secretary|receptionist|office|technician|vocational|ausbildung|apprentic|head of it|it specialist|system(s)? engineer|electrician|plumber|housekeeping|security guard|nurse|medical officer|marketing|sales)\b/i;
const RESEARCH_TEXT = /\b(research project|doctoral|ph\.?\s?d|thesis|dissertation|postdoctoral|laboratory|research group|principal investigator|funded project)\b/i;

/**
 * research: a research role in the title (or the source's own include pattern), or a research context in
 * the description; non_research: an administrative/technical/vocational title with no research signal;
 * uncertain: anything else. Uncertain entries are kept but held for review, never shown as verified.
 */
export function classifyRole(title: string, description: string | null, include: RegExp | null): "research" | "non_research" | "uncertain" {
  const researchTitle = RESEARCH_TITLE.test(title) || Boolean(include?.test(title));
  if (NON_RESEARCH_TITLE.test(title) && !researchTitle) return "non_research";
  if (researchTitle && !NON_RESEARCH_TITLE.test(title)) return "research";
  if (researchTitle) return /\b(research|scientist|fellow|ph\.?\s?d|post-?doc)\b/i.test(title) ? "research" : "uncertain"; // e.g. "Project Assistant (Admin)"
  if (description && RESEARCH_TEXT.test(description)) return "research";
  return "uncertain";
}

/**
 * Translations of one opening (e.g. HZDR publishes German and English entries with the same "2026/135"
 * reference) are one listing: the English-looking entry is kept, the others counted as duplicates.
 */
export function collapseTranslations<T extends { title: string }>(entries: T[]): { kept: T[]; duplicates: number } {
  const ref = (t: string) => /(?:^|\s)(\d{4}\/\d{1,5})\s*$/.exec(t.trim())?.[1] ?? null;
  const englishness = (t: string) => (/\(f\/m\/d\)|\b(the|and|for|of|in|student|position)\b/i.test(t) ? 1 : 0) - (/[äöüß]|\(w\/m\/d\)|\b(und|für|der|die|das|im)\b/i.test(t) ? 1 : 0);
  const byRef = new Map<string, T>();
  const kept: T[] = [];
  let duplicates = 0;
  for (const e of entries) {
    const r = ref(e.title);
    if (!r) {
      kept.push(e);
      continue;
    }
    const prev = byRef.get(r);
    if (!prev) {
      byRef.set(r, e);
      kept.push(e);
    } else {
      duplicates++;
      if (englishness(e.title) > englishness(prev.title)) {
        kept[kept.indexOf(prev)] = e;
        byRef.set(r, e);
      }
    }
  }
  return { kept, duplicates };
}

function compileInclude(pattern: string | null): RegExp | null {
  if (!pattern) return null;
  try {
    return new RegExp(pattern, "i");
  } catch {
    throw new Error("INVALID_INCLUDE_PATTERN");
  }
}

async function collect(source: OpportunitySource, body: string, contentType: string): Promise<Candidate[]> {
  if (source.kind === "page_monitor") {
    const { ADAPTERS } = await import("./adapters");
    const adapter = source.adapter ? ADAPTERS[source.adapter] : undefined;
    if (!adapter) throw new Error("UNKNOWN_ADAPTER");
    return adapter(body, source.url!).map((e) => ({ ...e, description: null }));
  }
  return parseFeed(body, contentType).map((e) => ({
    externalId: e.externalId ?? e.url ?? e.title,
    title: e.title,
    url: e.url,
    description: e.description,
    publishedAt: e.publishedAt,
    researchGroup: null,
    deadline: null,
    deadlineAt: null,
    statusHint: null,
    rolling: false,
  }));
}

const BACKOFF_MAX_MS = 24 * 3600_000;
const LEASE_MS = 10 * 60_000;

/** Takes a lease on the source so two refreshes of it never overlap. False when another run holds it. */
async function claim(db: OppDb, id: string, now: Date): Promise<boolean> {
  const got = await db
    .update(opportunitySources)
    .set({ lockedUntil: new Date(now.getTime() + LEASE_MS), lastFetchedAt: now })
    .where(and(eq(opportunitySources.id, id), or(sql`${opportunitySources.lockedUntil} IS NULL`, lt(opportunitySources.lockedUntil, now))))
    .returning({ id: opportunitySources.id });
  return got.length === 1;
}

async function fail(db: OppDb, source: OpportunitySource, error: string, now: Date): Promise<RefreshOutcome> {
  const failures = source.consecutiveFailures + 1;
  const delay = Math.min(BACKOFF_MAX_MS, source.minFetchIntervalMinutes * 60_000 * 2 ** Math.min(failures - 1, 6));
  await recordSource(db, source.id, { lastError: error, consecutiveFailures: failures, nextAttemptAt: new Date(now.getTime() + delay), lockedUntil: null });
  return { status: "failed", error };
}

export async function refreshSource(db: OppDb, source: OpportunitySource, opts: { fetchImpl?: Fetch; now?: Date } = {}): Promise<RefreshOutcome> {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!source.enabled) return { status: "skipped", reason: "disabled" };
  if (source.kind === "manual" || !source.url) return { status: "skipped", reason: "manual_source" };
  // Only an explicitly approved source is collected; robots.txt permission alone is never enough.
  if (source.termsStatus !== "approved") return { status: "skipped", reason: "not_approved" };
  if (source.lastFetchedAt && now.getTime() - source.lastFetchedAt.getTime() < source.minFetchIntervalMinutes * 60_000) {
    return { status: "skipped", reason: "interval" };
  }
  if (source.nextAttemptAt && source.nextAttemptAt.getTime() > now.getTime()) return { status: "skipped", reason: "backoff" };
  if (!(await claim(db, source.id, now))) return { status: "skipped", reason: "locked" };

  let candidates: Candidate[];
  let filteredOut = 0;
  let translationDuplicates = 0;
  const uncertainRoles = new Set<string>();
  try {
    const include = compileInclude(source.includePattern);
    const pageUrl = new URL(source.url);
    const robots = await timedFetch(fetchImpl, `${pageUrl.origin}/robots.txt`).catch(() => null);
    if (robots?.ok && !robotsAllows(await robots.text(), pageUrl.pathname)) throw new Error("ROBOTS_DISALLOWED");
    const res = await timedFetch(fetchImpl, source.url);
    if (res.status === 429) throw new Error("RATE_LIMITED_BY_SOURCE");
    if (res.status === 401 || res.status === 403) throw new Error(`ACCESS_DENIED_${res.status}`); // never bypassed
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    const body = await res.text();
    if (body.length > MAX_BODY_BYTES) throw new Error("RESPONSE_TOO_LARGE");
    const collected = collapseTranslations(await collect(source, body, res.headers.get("content-type") ?? ""));
    translationDuplicates = collected.duplicates;
    candidates = [];
    for (const c of collected.kept) {
      const role = classifyRole(c.title, c.description, include);
      if (role === "non_research") filteredOut++;
      else {
        if (role === "uncertain") uncertainRoles.add(c.externalId);
        candidates.push(c);
      }
    }
  } catch (e) {
    return fail(db, source, errorCode(e), now);
  }

  const existing = await db.select().from(opportunities).where(eq(opportunities.sourceId, source.id));
  const seenIds = new Set<string>();
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;
  const pageCanon = canonicalUrl(source.url)!;

  for (const c of candidates) {
    const externalId = c.externalId.slice(0, 500);
    // A listing without its own link is identified by the official page plus its id (fragment only, no invented path).
    const canon = canonicalUrl(c.url) ?? `${pageCanon}#${encodeURIComponent(externalId).slice(0, 200)}`;
    const mine = existing.find((r) => r.externalId === externalId) ?? existing.find((r) => r.canonicalUrl === canon);
    const base = decideStatus(source, c, now);
    // An unclear role type is held for review even when the source is trusted (expired/closed still win).
    const decided = base.status === "active" && uncertainRoles.has(c.externalId) ? { status: "unverified" as const, reason: "Role type unclear: held for review" } : base;
    // A listing an operator already verified stays verified unless the source now says it closed or expired.
    const status = decided.status === "unverified" && mine?.status === "active" ? "active" : decided.status;
    const values = {
      title: c.title.slice(0, 300),
      organization: source.organization,
      country: source.country,
      type: "research",
      kind: kindFromTitle(c.title),
      description: c.description,
      url: c.url ?? source.url,
      canonicalUrl: canon,
      externalId,
      sourceId: source.id,
      origin: source.kind === "page_monitor" ? "page_monitor" : "feed",
      status,
      statusReason: status === decided.status ? decided.reason : mine?.statusReason ?? null,
      researchGroup: c.researchGroup,
      deadline: c.deadline,
      deadlineAt: c.deadlineAt,
      publishedAt: c.publishedAt,
      lastVerifiedAt: status === "active" ? now : mine?.lastVerifiedAt ?? null,
      updatedAt: now,
    };
    if (mine) {
      seenIds.add(mine.id);
      // A listing withdrawn by an operator or by a broken link is not revived by a refresh.
      if (mine.status === "withdrawn" && mine.statusReason?.startsWith("Original link")) continue;
      await db.update(opportunities).set(mine.status === "expired" && status !== "expired" ? { ...values, status: "expired", statusReason: mine.statusReason } : values).where(eq(opportunities.id, mine.id));
      updated++;
      continue;
    }
    const clash = await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.canonicalUrl, canon)).limit(1);
    if (clash.length) {
      duplicates++; // already listed from another source: keep the first, never list twice
      continue;
    }
    await db.insert(opportunities).values(values);
    inserted++;
  }

  // Absence means removal only for sources that list every open position (withdraw_on_absence).
  const gone = source.withdrawOnAbsence
    ? existing.filter((r) => !seenIds.has(r.id) && (r.status === "active" || r.status === "unverified")).map((r) => r.id)
    : [];
  if (gone.length) {
    await db.update(opportunities).set({ status: "withdrawn", statusReason: "No longer listed by the source", updatedAt: now }).where(inArray(opportunities.id, gone));
  }
  await recordSource(db, source.id, { lastSuccessAt: now, lastError: null, consecutiveFailures: 0, nextAttemptAt: null, lockedUntil: null, lastSeenCount: candidates.length + filteredOut, lastFilteredCount: filteredOut, lastDuplicateCount: duplicates + translationDuplicates });
  return { status: "ok", seen: candidates.length, inserted, updated, withdrawn: gone.length, duplicates: duplicates + translationDuplicates, filtered: filteredOut };
}

/** One scheduled pass: every enabled, due source (failures isolated), then lifecycle and link checks. Idempotent. */
export async function refreshDueSources(db: OppDb, opts: { fetchImpl?: Fetch; now?: Date; linkCheckLimit?: number; extractLimit?: number; skipReminders?: boolean } = {}) {
  const now = opts.now ?? new Date();
  const sources = await db.select().from(opportunitySources).where(eq(opportunitySources.enabled, true));
  const results: Record<string, RefreshOutcome> = {};
  for (const s of sources) {
    try {
      results[s.id] = await refreshSource(db, s, { fetchImpl: opts.fetchImpl, now });
    } catch (e) {
      results[s.id] = { status: "failed", error: errorCode(e) };
      await recordSource(db, s.id, { lockedUntil: null }).catch(() => undefined);
    }
  }
  const lifecycle = await applyLifecycle(db, now);
  const links = await checkLinks(db, { fetchImpl: opts.fetchImpl, now, limit: opts.linkCheckLimit ?? 20 });
  // Each step is isolated: a failure in one never stops the others or the next pass.
  const { runExtraction } = await import("./extract");
  const extraction = await runExtraction(db, { fetchImpl: opts.fetchImpl, now, limit: opts.extractLimit ?? 15 }).catch((e) => ({ error: errorCode(e) }));
  const { sendDeadlineReminders } = await import("./reminders");
  const reminders = opts.skipReminders ? { skipped: "disabled" } : await sendDeadlineReminders(db, { now }).catch((e) => ({ error: errorCode(e) }));
  return { results, lifecycle, links, extraction, reminders };
}

/**
 * Broken-link detection for active listings (oldest check first, at most `limit` per pass, re-checked
 * every 3 days). Only an explicit 404 or 410 withdraws a listing; timeouts and other errors never do.
 */
export async function checkLinks(db: OppDb, opts: { fetchImpl?: Fetch; now?: Date; limit?: number } = {}) {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  const due = new Date(now.getTime() - 3 * 86_400_000);
  const rows = await db
    .select({ id: opportunities.id, url: opportunities.url })
    .from(opportunities)
    .where(and(eq(opportunities.status, "active"), or(sql`${opportunities.linkCheckedAt} IS NULL`, lt(opportunities.linkCheckedAt, due))))
    .orderBy(sql`${opportunities.linkCheckedAt} asc nulls first`)
    .limit(opts.limit ?? 20);
  let broken = 0;
  for (const r of rows) {
    if (!r.url) continue;
    let status: number | null = null;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
      try {
        let res = await fetchImpl(r.url, { method: "HEAD", headers: { "user-agent": USER_AGENT }, signal: ctrl.signal, redirect: "follow" });
        if (res.status === 405 || res.status === 501) res = await fetchImpl(r.url, { method: "GET", headers: { "user-agent": USER_AGENT }, signal: ctrl.signal, redirect: "follow" });
        status = res.status;
      } finally {
        clearTimeout(t);
      }
    } catch {
      status = null; // unreachable right now: not evidence the listing is gone
    }
    const goneForGood = status === 404 || status === 410;
    if (goneForGood) broken++;
    await db
      .update(opportunities)
      .set(goneForGood ? { linkCheckedAt: now, linkStatus: status, status: "withdrawn", statusReason: `Original link no longer available (HTTP ${status})`, updatedAt: now } : { linkCheckedAt: now, linkStatus: status })
      .where(eq(opportunities.id, r.id));
  }
  return { checked: rows.length, broken };
}
export interface CuratedListingInput {
  sourceId: string;
  title: string;
  organization?: string;
  kind: string;
  url: string;
  description?: string | null;
  eligibility?: string | null;
  eligibleLevels?: string[];
  requiredSkills?: string[];
  location?: string | null;
  workMode?: string | null;
  /** Exactly as published (e.g. "15 December 2026"); deadlineAt only when an exact date was published. */
  deadline?: string | null;
  deadlineAt?: Date | null;
  publishedAt?: Date | null;
  /** The operator opened the official page and confirmed the opportunity is open, at this time. */
  verifiedAt: Date | null;
}

export async function addCuratedListing(db: OppDb, input: CuratedListingInput): Promise<{ id: string; duplicate: boolean }> {
  const [source] = await db.select().from(opportunitySources).where(eq(opportunitySources.id, input.sourceId)).limit(1);
  if (!source) throw new Error("UNKNOWN_SOURCE");
  if (source.kind !== "manual") throw new Error("CURATED_NEEDS_MANUAL_SOURCE");
  const canon = canonicalUrl(input.url);
  if (!canon) throw new Error("SOURCE_URL_REQUIRED");
  if (!input.title.trim()) throw new Error("TITLE_REQUIRED");
  const [dup] = await db.select({ id: opportunities.id }).from(opportunities).where(eq(opportunities.canonicalUrl, canon)).limit(1);
  if (dup) return { id: dup.id, duplicate: true };
  const [row] = await db
    .insert(opportunities)
    .values({
      title: input.title.trim(),
      organization: input.organization?.trim() || source.organization,
      type: "research",
      kind: input.kind,
      url: input.url,
      canonicalUrl: canon,
      externalId: canon,
      sourceId: source.id,
      origin: "curated",
      description: input.description ?? null,
      eligibility: input.eligibility ?? null,
      eligibleLevels: input.eligibleLevels ?? [],
      requiredSkills: input.requiredSkills ?? [],
      location: input.location ?? null,
      workMode: input.workMode ?? null,
      deadline: input.deadline ?? null,
      deadlineAt: input.deadlineAt ?? null,
      publishedAt: input.publishedAt ?? null,
      lastVerifiedAt: input.verifiedAt,
      status: input.verifiedAt ? "active" : "unverified",
      statusReason: input.verifiedAt ? null : "Not yet verified at the source",
    })
    .returning({ id: opportunities.id });
  return { id: row!.id, duplicate: false };
}

/** Idempotent. Never deletes; expired/stale listings simply stop being recommended. */
export async function applyLifecycle(db: OppDb, now = new Date()): Promise<{ expired: number; stale: number }> {
  const expired = await db
    .update(opportunities)
    .set({ status: "expired", statusReason: "Application deadline has passed", updatedAt: now })
    .where(and(isNotNull(opportunities.deadlineAt), lt(opportunities.deadlineAt, now), or(eq(opportunities.status, "active"), eq(opportunities.status, "unverified"))))
    .returning({ id: opportunities.id });
  const cutoff = new Date(now.getTime() - VERIFICATION_TTL_DAYS * 86_400_000);
  const stale = await db
    .update(opportunities)
    .set({ status: "unverified", statusReason: `Not re-verified in ${VERIFICATION_TTL_DAYS} days`, updatedAt: now })
    .where(and(eq(opportunities.status, "active"), or(sql`${opportunities.lastVerifiedAt} IS NULL`, lt(opportunities.lastVerifiedAt, cutoff))))
    .returning({ id: opportunities.id });
  return { expired: expired.length, stale: stale.length };
}
