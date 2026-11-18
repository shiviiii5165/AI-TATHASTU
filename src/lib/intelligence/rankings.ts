import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  intelligenceRankingProfiles as profiles,
  intelligenceRankingSnapshots as snapshots,
  intelligenceRankingVersions as versions,
  type IntelligenceRankingProfile,
} from "@/db/schema";

import { loadCatalogue, loadCohort, loadSignals, MEASUREMENTS, type CohortStudent } from "./catalogue";
import { cohortKey, computeRanking, evenWeights, validateDefinition } from "./engine";
import type { BenchmarkDef, CohortFilter, RankingDefinition, SignalMatrix, SnapshotRow, StudentResult } from "./types";

/** True when the error is "table does not exist" (migration 0032 not applied yet). */
export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string }; message?: string };
  return e?.code === "42P01" || e?.cause?.code === "42P01" || /relation "intelligence_/.test(e?.message ?? "");
}

export const AUTO_ID = "auto";

/**
 * The ranking shown before any admin has defined one: every measurement family with at least one student's evidence,
 * equal weights. Derived from the data, not a fixed rule, and labelled as such in the UI.
 */
export function autoDefinition(signals: SignalMatrix): RankingDefinition {
  const present = new Set<string>();
  for (const row of signals.values()) for (const k of row.keys()) present.add(k);
  const families = new Map<string, BenchmarkDef[]>();
  for (const b of MEASUREMENTS) {
    if (!present.has(b.key) || b.family === "Platform engagement") continue; // engagement is activity, not ability
    families.set(b.family, [...(families.get(b.family) ?? []), b]);
  }
  const cats = [...families.entries()];
  const catW = evenWeights(cats.length);
  return {
    schema: 1,
    categories: cats.map(([family, bs], i) => {
      const w = evenWeights(bs.length);
      return {
        id: `auto-${i}`,
        name: family,
        weight: catW[i],
        benchmarks: bs.map((b, j) => ({ key: b.key, weight: w[j], normalization: b.defaultNormalization, target: b.defaultTarget })),
      };
    }),
    cohort: {},
    eligibility: { minCoverage: 50, requiredBenchmarks: [] },
    evidencePolicy: "any",
    missingPolicy: "neutral",
  };
}

export interface ProfilesState {
  available: boolean;
  profiles: IntelligenceRankingProfile[];
}

export async function listProfiles(includeArchived = false): Promise<ProfilesState> {
  try {
    const rows = await db
      .select()
      .from(profiles)
      .where(includeArchived ? undefined : sql`${profiles.status} <> 'archived'`)
      .orderBy(desc(profiles.updatedAt));
    return { available: true, profiles: rows };
  } catch (err) {
    if (isMissingTable(err)) return { available: false, profiles: [] };
    throw err;
  }
}

export async function getProfile(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  try {
    const [row] = await db.select().from(profiles).where(eq(profiles.id, id));
    return row ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

export async function listVersions(profileId: string) {
  try {
    return await db.select().from(versions).where(eq(versions.profileId, profileId)).orderBy(desc(versions.version));
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

export async function getVersion(profileId: string, version: number) {
  const [row] = await db.select().from(versions).where(and(eq(versions.profileId, profileId), eq(versions.version, version)));
  return row ?? null;
}

export async function listSnapshots(profileId: string, limit = 20) {
  try {
    return await db
      .select({
        id: snapshots.id, version: snapshots.version, cohort: snapshots.cohort, cohortKey: snapshots.cohortKey,
        rankedCount: snapshots.rankedCount, ineligibleCount: snapshots.ineligibleCount,
        computedAt: snapshots.computedAt, computedByEmail: snapshots.computedByEmail,
      })
      .from(snapshots)
      .where(eq(snapshots.profileId, profileId))
      .orderBy(desc(snapshots.computedAt))
      .limit(limit);
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/** The most recent snapshot of the same version and cohort: the only fair baseline for rank movement. */
export async function previousSnapshot(profileId: string, version: number, key: string) {
  try {
    const [row] = await db
      .select({ results: snapshots.results, computedAt: snapshots.computedAt })
      .from(snapshots)
      .where(and(eq(snapshots.profileId, profileId), eq(snapshots.version, version), eq(snapshots.cohortKey, key)))
      .orderBy(desc(snapshots.computedAt))
      .limit(1);
    return row ?? null;
  } catch (err) {
    if (isMissingTable(err)) return null;
    throw err;
  }
}

/** Every snapshot a student appears in for one profile, oldest first (rank history). */
export async function studentRankHistory(userId: string) {
  try {
    const { rows } = await db.execute(sql`
      SELECT s.profile_id::text AS "profileId", p.name, s.version, s.computed_at AS "computedAt", s.ranked_count AS "rankedCount",
             r->>'rank' AS rank, r->>'score' AS score
      FROM intelligence_ranking_snapshots s
      JOIN intelligence_ranking_profiles p ON p.id = s.profile_id
      CROSS JOIN LATERAL jsonb_array_elements(s.results) r
      WHERE r->>'userId' = ${userId}
      ORDER BY s.computed_at`);
    return rows as unknown as { profileId: string; name: string; version: number; computedAt: string; rankedCount: number; rank: string | null; score: string | null }[];
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

export interface RankingRun {
  definition: RankingDefinition;
  cohort: CohortStudent[];
  results: StudentResult[];
  catalogue: Map<string, BenchmarkDef>;
  catalogueList: BenchmarkDef[];
  signals: SignalMatrix;
  computedAt: Date;
}

/** Runs a definition over its cohort, with an optional extra cohort filter from the page. */
export async function runRanking(definition: RankingDefinition | null, extra: CohortFilter = {}): Promise<RankingRun> {
  const { list, byKey, skills } = await loadCatalogue();
  const baseCohort: CohortFilter = { ...(definition?.cohort ?? {}), ...stripEmpty(extra) };
  const [cohort, signals] = await Promise.all([loadCohort(baseCohort), loadSignals(baseCohort, skills)]);
  const def = definition ?? autoDefinition(signals);
  const results = computeRanking(def, cohort.map((s) => s.id), signals, byKey);
  return { definition: def, cohort, results, catalogue: byKey, catalogueList: list, signals, computedAt: new Date() };
}

export function stripEmpty(c: CohortFilter): CohortFilter {
  return Object.fromEntries(Object.entries(c).filter(([, v]) => typeof v === "string" && v.trim())) as CohortFilter;
}

export function toSnapshotRows(results: StudentResult[]): SnapshotRow[] {
  return results.map((r) => ({
    userId: r.userId, rank: r.rank, score: r.score, coverage: r.coverage, eligible: r.eligible, provisional: r.provisional,
    categories: r.categories.map((c) => ({ id: c.id, score: c.score })),
  }));
}

export { cohortKey, validateDefinition };
