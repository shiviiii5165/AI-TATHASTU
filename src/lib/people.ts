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
    .orderBy(sql`${distance} asc nulls last`)
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
