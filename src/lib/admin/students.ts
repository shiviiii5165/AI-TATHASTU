import "server-only";

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  connections,
  sessions,
  type User,
  users,
} from "@/db/schema";
import { processAccountDeletion, requestAccountDeletion, retryAccountDeletionNow } from "@/lib/account-deletion";
import { recordAdminAudit } from "./audit";

export interface ListStudentsOptions {
  query?: string;
  role?: string;
  university?: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

export async function listStudents(options: ListStudentsOptions = {}) {
  const limit = Math.min(options.limit ?? 25, 100);
  const offset = options.offset ?? 0;

  const conditions = [];

  if (!options.includeDeleted) {
    conditions.push(isNull(users.deletedAt));
  }

  if (options.role) {
    conditions.push(eq(users.role, options.role as (typeof users.$inferSelect)["role"]));
  }

  if (options.university) {
    conditions.push(ilike(users.university, `%${options.university.trim()}%`));
  }

  if (options.query) {
    const search = `%${options.query.trim()}%`;
    conditions.push(
      or(
        ilike(users.name, search),
        ilike(users.email, search),
        ilike(users.university, search),
        ilike(users.degree, search)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const studentRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      university: users.university,
      degree: users.degree,
      academicYear: users.academicYear,
      image: users.image,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(whereClause)
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(whereClause);

  return {
    students: studentRows,
    total: Number(countResult?.count ?? 0),
  };
}

export interface StudentDetail extends User {
  activeSessionsCount: number;
  linkedConnections: { sourceId: string; lastSyncAt: Date | null }[];
}

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return null;

  const userConnections = await db
    .select({
      sourceId: connections.sourceId,
      lastSyncAt: connections.lastSyncAt,
    })
    .from(connections)
    .where(eq(connections.userId, userId));

  const [sessionCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sessions)
    .where(eq(sessions.userId, userId));

  return {
    ...user,
    activeSessionsCount: Number(sessionCount?.count ?? 0),
    linkedConnections: userConnections,
  };
}

/**
 * Revokes all sessions for a student. Sign-in uses JWTs, so bumping session_version
 * is what ends them; revokedCount counts only legacy database rows.
 */
export async function revokeStudentSessions(
  userId: string,
  actorEmail: string
): Promise<{ revokedCount: number }> {
  const [, deleted] = await db.batch([
    db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, userId)),
    db.delete(sessions).where(eq(sessions.userId, userId)).returning(),
  ]);

  await recordAdminAudit({
    actorEmail,
    action: "student.sessions_revoke",
    resource: "sessions",
    targetId: userId,
    details: { revokedCount: deleted.length },
  });

  return { revokedCount: deleted.length };
}

/**
 * Permanently deletes a student's account. Safe to re-run. Operators are refused by
 * requestAccountDeletion. The audit entry outlives the account, so it holds no name or address.
 */
export async function executeStudentDeletionWorkflow(
  userId: string,
  actorEmail: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  await requestAccountDeletion(userId, {
    requestedBy: "admin",
    actorEmail,
    action: "student.delete_workflow",
    details: { reason },
  });
  await retryAccountDeletionNow(userId);
  const progress = await processAccountDeletion(userId);

  return {
    success: true,
    message: progress?.dataDeleted
      ? "Account data deleted. Final cleanup finishes automatically."
      : "Account locked. Cleanup didn't finish and will retry automatically.",
  };
}
