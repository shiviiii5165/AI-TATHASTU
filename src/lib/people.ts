import "server-only";

import { and, eq, isNotNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { collaborationEmbeddings as ce, users } from "@/db/schema";
import { discoverableBy, type Viewer } from "@/lib/discovery";

export type SimilarPerson = {
  id: string;
  name: string | null;
  role: Viewer["role"];
  department: string | null;
  institution: string | null;
  summary: string | null;
  /** Cosine similarity 0–1, or null when the viewer has no embedding yet. */
  similarity: number | null;
};

/**
 * Discoverable people (src/lib/discovery.ts) ordered by pgvector cosine
 * distance to the viewer's collaboration embedding, in one query.
 *
 * The `+ 0` keeps the planner off the HNSW index on purpose. That index yields
 * only hnsw.ef_search (40) nearest rows and the discovery filter runs after, so
 * it returned 4 of 24 requested with 3,000 eligible at 20k users, and could
 * return none. The exact sort is linear in users: 24 ms for a student and 101 ms
 * for a mentor at 20k (local Postgres). When that gets slow, move to pgvector's
 * hnsw.iterative_scan = strict_order (24/24 correct at 20k in about the same time;
 * relaxed_order got 13/24), which needs a batch transaction to SET LOCAL and
 * pgvector >= 0.8 on Neon.
 */
export async function similarPeople(viewer: Viewer, limit: number): Promise<SimilarPerson[]> {
  const viewerVec = sql`(select ${ce.embedding} from ${ce} where ${ce.userId} = ${viewer.id})`;
  const distance = sql<number | null>`(${ce.embedding} <=> ${viewerVec})::float`;
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      department: users.department,
      institution: users.university,
      summary: ce.profileSummary,
      distance,
    })
    .from(ce)
    .innerJoin(users, eq(users.id, ce.userId))
    .where(and(discoverableBy(viewer), isNotNull(ce.embedding)))
    .orderBy(sql`${distance} + 0 asc nulls last`)
    .limit(limit);
  return rows.map(({ distance: d, ...r }) => ({
    ...r,
    similarity: d === null ? null : Math.max(0, Math.min(1, 1 - Number(d))),
  }));
}

/** Role of a signed-in, non-deleted account (API routes only have the session id). */
export async function viewerFor(userId: string): Promise<Viewer | null> {
  const [row] = await db.select({ role: users.role, deletedAt: users.deletedAt }).from(users).where(eq(users.id, userId));
  return row && !row.deletedAt ? { id: userId, role: row.role } : null;
}
