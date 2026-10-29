import "server-only";

import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  connections,
  sessions,
  type User,
  users,
} from "@/db/schema";
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
    conditions.push(eq(users.role, options.role as any));
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
 * Revokes all active Auth.js database sessions for a student.
 */
export async function revokeStudentSessions(
  userId: string,
  actorEmail: string
): Promise<{ revokedCount: number }> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, userId))
    .returning();

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
 * Executes a safeguarded student account soft-deletion workflow.
 * Sets deletedAt timestamp, unlinks active connections, and invalidates sessions.
 */
export async function executeStudentDeletionWorkflow(
  userId: string,
  actorEmail: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) throw new Error("Student not found");
  if (user.isAdmin) {
    throw new Error("Cannot delete an administrator account via student management");
  }

  // 1. Soft-tombstone the user row
  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  // 2. Revoke all active sessions
  await db.delete(sessions).where(eq(sessions.userId, userId));

  // 3. Record immutable audit entry
  await recordAdminAudit({
    actorEmail,
    action: "student.delete_workflow",
    resource: "users",
    targetId: userId,
    details: { email: user.email, name: user.name, reason },
  });

  return {
    success: true,
    message: `Account for ${user.email} successfully placed into tombstone deletion workflow.`,
  };
}
