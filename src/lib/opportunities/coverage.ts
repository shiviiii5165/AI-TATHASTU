/**
 * Source coverage report: per source, its review and health state next to the real numbers of verified
 * active, needs-review and rejected listings. Institutions registered are never presented as opportunities.
 */
import { sql } from "drizzle-orm";

import { opportunities, opportunitySources } from "@/db/schema";

import { REJECTED_SOURCES } from "./catalogue";
import type { OppDb } from "./ingest";
import { recommendableWhere } from "./recommend";

export interface CoverageRow {
  id: string;
  organization: string;
  country: string | null;
  kind: string;
  termsStatus: string;
  enabled: boolean;
  lastSuccessAt: string | null;
  health: "healthy" | "failing" | "stale" | "never_fetched" | "disabled";
  lastError: string | null;
  active: number;
  needsReview: number;
  closedOrExpired: number;
  withdrawn: number;
  filteredLastRefresh: number | null;
}

export async function coverageReport(db: OppDb, now = new Date()) {
  const sources = await db.select().from(opportunitySources);
  const counts = await db
    .select({
      sourceId: opportunities.sourceId,
      active: sql<number>`count(*) filter (where ${recommendableWhere(now)})::int`,
      needsReview: sql<number>`count(*) filter (where ${opportunities.status} = 'unverified')::int`,
      expired: sql<number>`count(*) filter (where ${opportunities.status} = 'expired')::int`,
      withdrawn: sql<number>`count(*) filter (where ${opportunities.status} = 'withdrawn')::int`,
    })
    .from(opportunities)
    .groupBy(opportunities.sourceId);
  const by = new Map(counts.map((c) => [c.sourceId, c]));
  const DAY = 86_400_000;
  const rows: CoverageRow[] = sources.map((s) => {
    const c = by.get(s.id);
    const health: CoverageRow["health"] = !s.enabled
      ? "disabled"
      : s.consecutiveFailures > 0
        ? "failing"
        : !s.lastSuccessAt
          ? "never_fetched"
          : now.getTime() - s.lastSuccessAt.getTime() > 3 * DAY
            ? "stale"
            : "healthy";
    return {
      id: s.id,
      organization: s.organization,
      country: s.country,
      kind: s.kind,
      termsStatus: s.termsStatus,
      enabled: s.enabled,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      health,
      lastError: s.lastError,
      active: c?.active ?? 0,
      needsReview: c?.needsReview ?? 0,
      closedOrExpired: c?.expired ?? 0,
      withdrawn: c?.withdrawn ?? 0,
      filteredLastRefresh: s.lastFilteredCount,
    };
  });
  return {
    generatedAt: now.toISOString(),
    totals: {
      sourcesRegistered: rows.length,
      sourcesApproved: rows.filter((r) => r.termsStatus === "approved").length,
      sourcesEnabled: rows.filter((r) => r.enabled).length,
      verifiedActiveOpportunities: rows.reduce((n, r) => n + r.active, 0),
      needsReview: rows.reduce((n, r) => n + r.needsReview, 0),
    },
    sources: rows,
    rejectedSources: REJECTED_SOURCES,
  };
}
