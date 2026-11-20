import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { loadCatalogue } from "./catalogue";
import { validateDefinition } from "./engine";
import { isMissingTable, listProfiles, listSnapshots, listVersions } from "./rankings";
import type { RankingDefinition, ValidationIssue } from "./types";

/**
 * Methodology and fairness review. Read-only. Reports what each ranking does and where evidence is unevenly
 * available; it makes no claim of statistical fairness, and never uses protected or demographic attributes
 * (only institution and academic year, which are cohort filters already).
 */

export interface RankingReview {
  id: string;
  name: string;
  status: string;
  publishedVersion: number;
  versionCount: number;
  definition: RankingDefinition;
  /** Problems under today's rules, e.g. an old definition that counts missing evidence as 0. */
  issues: ValidationIssue[];
  latestSnapshot: { version: number; rankedCount: number; ineligibleCount: number; computedAt: Date } | null;
}

export async function reviewRankings(): Promise<{ available: boolean; rankings: RankingReview[] }> {
  const [{ available, profiles }, catalogue] = await Promise.all([listProfiles(true), loadCatalogue()]);
  const known = new Set(catalogue.byKey.keys());
  const rankings = await Promise.all(
    profiles.map(async (p) => {
      const [versions, snaps] = await Promise.all([listVersions(p.id), listSnapshots(p.id, 1)]);
      const def = p.definition as RankingDefinition;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        publishedVersion: p.publishedVersion,
        versionCount: versions.length,
        definition: def,
        issues: validateDefinition(def, known),
        latestSnapshot: snaps[0] ? { version: snaps[0].version, rankedCount: snaps[0].rankedCount, ineligibleCount: snaps[0].ineligibleCount, computedAt: snaps[0].computedAt } : null,
      };
    }),
  );
  return { available, rankings };
}

/** Groups smaller than this are not reported: their rates would be noise and could identify individuals. */
export const MIN_GROUP_SIZE = 5;
/** A gap this large (percentage points) from the overall rate is flagged for review. */
export const GAP_FLAG_POINTS = 20;

export interface AvailabilityRow {
  group: string;
  students: number;
  /** Percent of the group's students with each kind of evidence. */
  rates: { profile: number; resume: number; connected: number; projects: number };
  flagged: (keyof AvailabilityRow["rates"])[];
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

/**
 * How often each kind of evidence exists, per institution or academic year, for active student accounts.
 * A gap means evidence is collected unevenly, so rankings can disadvantage that group; it says nothing about ability.
 */
export async function evidenceAvailability(by: "institution" | "academic_year"): Promise<{ overall: AvailabilityRow; groups: AvailabilityRow[]; smallGroupsHidden: number }> {
  const groupExpr = by === "institution" ? sql`coalesce(i.canonical_name, nullif(trim(u.university), ''), 'Not given')` : sql`coalesce(nullif(trim(u.academic_year), ''), 'Not given')`;
  try {
    const { rows } = await db.execute(sql`
      WITH s AS (
        SELECT u.id, ${groupExpr} AS grp,
               (pv.view -> 'intelligence') IS NOT NULL AS has_profile,
               EXISTS (SELECT 1 FROM files f WHERE f.user_id = u.id AND f.kind = 'resume') AS has_resume,
               EXISTS (SELECT 1 FROM connections c WHERE c.user_id = u.id AND c.status = 'connected') AS has_connected,
               EXISTS (SELECT 1 FROM profile_facts pf WHERE pf.user_id = u.id AND pf.field_group = 'projects' AND pf.superseded_by IS NULL AND pf.confirmation <> 'rejected') AS has_projects
          FROM users u
          LEFT JOIN institutions i ON i.id = u.institution_id
          LEFT JOIN profile_views pv ON pv.user_id = u.id
         WHERE u.deleted_at IS NULL AND u.role = 'student'
      )
      SELECT grp, count(*)::int AS n,
             count(*) FILTER (WHERE has_profile)::int AS profile,
             count(*) FILTER (WHERE has_resume)::int AS resume,
             count(*) FILTER (WHERE has_connected)::int AS connected,
             count(*) FILTER (WHERE has_projects)::int AS projects
        FROM s GROUP BY ROLLUP (grp)
        ORDER BY n DESC`);
    type R = { grp: string | null; n: number; profile: number; resume: number; connected: number; projects: number };
    const all = rows as unknown as R[];
    const total = all.find((r) => r.grp === null) ?? { grp: null, n: 0, profile: 0, resume: 0, connected: 0, projects: 0 };
    const toRow = (r: R): AvailabilityRow => ({
      group: r.grp ?? "All students",
      students: Number(r.n),
      rates: { profile: pct(r.profile, r.n), resume: pct(r.resume, r.n), connected: pct(r.connected, r.n), projects: pct(r.projects, r.n) },
      flagged: [],
    });
    const overall = toRow(total);
    const named = all.filter((r) => r.grp !== null);
    const groups = named
      .filter((r) => Number(r.n) >= MIN_GROUP_SIZE)
      .map((r) => {
        const row = toRow(r);
        row.flagged = (Object.keys(row.rates) as (keyof AvailabilityRow["rates"])[]).filter((k) => Math.abs(row.rates[k] - overall.rates[k]) >= GAP_FLAG_POINTS);
        return row;
      });
    return { overall, groups, smallGroupsHidden: named.length - groups.length };
  } catch (err) {
    if (isMissingTable(err)) return { overall: { group: "All students", students: 0, rates: { profile: 0, resume: 0, connected: 0, projects: 0 }, flagged: [] }, groups: [], smallGroupsHidden: 0 };
    throw err;
  }
}
