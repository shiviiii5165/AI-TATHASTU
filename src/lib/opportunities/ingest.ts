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
  | { status: "skipped"; reason: "disabled" | "manual_source" | "interval" | "terms_not_reviewed" }
  | { status: "failed"; error: string }
  | { status: "ok"; seen: number; inserted: number; updated: number; withdrawn: number; duplicates: number };

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

async function timedFetch(fetchImpl: Fetch, url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetchImpl(url, { headers: { "user-agent": USER_AGENT, accept: "application/rss+xml, application/atom+xml, application/feed+json, application/json, text/xml;q=0.8" }, signal: ctrl.signal, redirect: "follow" });
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

export async function refreshSource(db: OppDb, source: OpportunitySource, opts: { fetchImpl?: Fetch; now?: Date } = {}): Promise<RefreshOutcome> {
  const now = opts.now ?? new Date();
  const fetchImpl = opts.fetchImpl ?? fetch;
  if (!source.enabled) return { status: "skipped", reason: "disabled" };
  if (source.kind === "manual" || !source.url) return { status: "skipped", reason: "manual_source" };
  if (!source.termsReviewedAt) return { status: "skipped", reason: "terms_not_reviewed" };
  if (source.lastFetchedAt && now.getTime() - source.lastFetchedAt.getTime() < source.minFetchIntervalMinutes * 60_000) {
    return { status: "skipped", reason: "interval" };
  }
  await recordSource(db, source.id, { lastFetchedAt: now });

  let body: string;
  let contentType: string;
  try {
    const feedUrl = new URL(source.url);
    const robots = await timedFetch(fetchImpl, `${feedUrl.origin}/robots.txt`).catch(() => null);
    if (robots?.ok && !robotsAllows(await robots.text(), feedUrl.pathname)) throw new Error("ROBOTS_DISALLOWED");
    const res = await timedFetch(fetchImpl, source.url);
    if (res.status === 429) throw new Error("RATE_LIMITED_BY_SOURCE");
    if (!res.ok) throw new Error(`HTTP_${res.status}`);
    body = await res.text();
    if (body.length > MAX_BODY_BYTES) throw new Error("FEED_TOO_LARGE");
    contentType = res.headers.get("content-type") ?? "";
  } catch (e) {
    const error = errorCode(e);
    await recordSource(db, source.id, { lastError: error });
    return { status: "failed", error };
  }

  let entries;
  try {
    entries = parseFeed(body, contentType);
  } catch (e) {
    const error = errorCode(e);
    await recordSource(db, source.id, { lastError: error });
    return { status: "failed", error };
  }

  const existing = await db.select().from(opportunities).where(eq(opportunities.sourceId, source.id));
  const seenIds = new Set<string>();
  let inserted = 0;
  let updated = 0;
  let duplicates = 0;

  for (const e of entries) {
    const canon = canonicalUrl(e.url);
    if (!canon) continue; // no verifiable source link: never listed
    const externalId = e.externalId?.slice(0, 500) || canon;
    const mine = existing.find((r) => r.externalId === externalId) ?? existing.find((r) => r.canonicalUrl === canon);
    const status = source.autoVerify ? "active" : mine?.status === "active" ? "active" : "unverified";
    const values = {
      title: e.title.slice(0, 300),
      organization: source.organization,
      type: "research",
      description: e.description,
      url: e.url!,
      canonicalUrl: canon,
      externalId,
      sourceId: source.id,
      origin: "feed",
      status,
      statusReason: status === "unverified" ? "Awaiting review: source is not auto-verified" : null,
      publishedAt: e.publishedAt,
      lastVerifiedAt: source.autoVerify ? now : mine?.lastVerifiedAt ?? null,
      updatedAt: now,
    };
    if (mine) {
      seenIds.add(mine.id);
      // A listing that already expired stays expired; anything else follows the source.
      await db.update(opportunities).set(mine.status === "expired" ? { ...values, status: "expired", statusReason: mine.statusReason } : values).where(eq(opportunities.id, mine.id));
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

  const gone = existing.filter((r) => !seenIds.has(r.id) && (r.status === "active" || r.status === "unverified")).map((r) => r.id);
  if (gone.length) {
    await db.update(opportunities).set({ status: "withdrawn", statusReason: "No longer listed by the source", updatedAt: now }).where(inArray(opportunities.id, gone));
  }
  await recordSource(db, source.id, { lastSuccessAt: now, lastError: null });
  return { status: "ok", seen: entries.length, inserted, updated, withdrawn: gone.length, duplicates };
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
