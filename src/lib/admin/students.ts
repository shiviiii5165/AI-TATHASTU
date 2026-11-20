import "server-only";

import { and, asc, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  connections,
  files,
  onboardingState,
  sessions,
  type User,
  users,
} from "@/db/schema";
import { processAccountDeletion, requestAccountDeletion, retryAccountDeletionNow } from "@/lib/account-deletion";
import { recordAdminAudit } from "./audit";

export const STUDENT_SORTS = { newest: "Newest first", oldest: "Oldest first", name: "Name A–Z" } as const;
export type StudentSort = keyof typeof STUDENT_SORTS;

export interface ListStudentsOptions {
  query?: string;
  role?: string;
  university?: string;
  degree?: string;
  academicYear?: string;
  graduationYear?: number;
  /** "complete" = onboarding_state.completed_at set; "incomplete" = not set or no onboarding row. */
  onboarding?: "complete" | "incomplete";
  sort?: StudentSort;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
}

const like = (v: string) => `%${v.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

export async function listStudents(options: ListStudentsOptions = {}) {
  const limit = Math.min(options.limit ?? 25, 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [];

  if (!options.includeDeleted) {
    conditions.push(isNull(users.deletedAt));
  }

  if (options.role) {
    conditions.push(eq(users.role, options.role as (typeof users.$inferSelect)["role"]));
  }

  if (options.university) {
    conditions.push(ilike(users.university, like(options.university)));
  }

  if (options.degree) {
    conditions.push(ilike(users.degree, like(options.degree)));
  }

  if (options.academicYear) {
    conditions.push(eq(users.academicYear, options.academicYear));
  }

  if (options.graduationYear) {
    conditions.push(eq(users.graduationYear, options.graduationYear));
  }

  if (options.onboarding === "complete") {
    conditions.push(isNotNull(onboardingState.completedAt));
  } else if (options.onboarding === "incomplete") {
    conditions.push(isNull(onboardingState.completedAt));
  }

  if (options.query) {
    const search = like(options.query);
    conditions.push(
      or(
        ilike(users.name, search),
        ilike(users.email, search),
        ilike(users.university, search),
        ilike(users.degree, search),
        ilike(users.specialization, search)
      )
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const order =
    options.sort === "oldest" ? [asc(users.createdAt)] : options.sort === "name" ? [sql`lower(coalesce(${users.name}, ${users.email})) asc`, asc(users.createdAt)] : [desc(users.createdAt)];

  // One query for the page and one for the full matching count; onboarding is a left join, never a per-row lookup.
  const studentRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      university: users.university,
      degree: users.degree,
      specialization: users.specialization,
      academicYear: users.academicYear,
      graduationYear: users.graduationYear,
      image: users.image,
      isAdmin: users.isAdmin,
      createdAt: users.createdAt,
      deletedAt: users.deletedAt,
      onboardingCompletedAt: onboardingState.completedAt,
      onboardingStep: onboardingState.currentStep,
    })
    .from(users)
    .leftJoin(onboardingState, eq(onboardingState.userId, users.id))
    .where(whereClause)
    .orderBy(...order)
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .leftJoin(onboardingState, eq(onboardingState.userId, users.id))
    .where(whereClause);

  return {
    students: studentRows,
    total: Number(countResult?.count ?? 0),
  };
}

/** Filter options from the data itself (never a fixed list), capped so a dropdown stays usable. */
export async function listStudentFacets() {
  const active = isNull(users.deletedAt);
  const [degrees, years, gradYears] = await Promise.all([
    db.selectDistinct({ v: users.degree }).from(users).where(and(active, isNotNull(users.degree))).orderBy(asc(users.degree)).limit(60),
    db.selectDistinct({ v: users.academicYear }).from(users).where(and(active, isNotNull(users.academicYear))).orderBy(asc(users.academicYear)).limit(20),
    db.selectDistinct({ v: users.graduationYear }).from(users).where(and(active, isNotNull(users.graduationYear))).orderBy(asc(users.graduationYear)).limit(30),
  ]);
  return {
    degrees: degrees.map((d) => d.v!).filter(Boolean),
    academicYears: years.map((d) => d.v!).filter(Boolean),
    graduationYears: gradYears.map((d) => d.v!).filter((v): v is number => typeof v === "number"),
  };
}

export interface StudentDetail extends User {
  activeSessionsCount: number;
  linkedConnections: { sourceId: string; status: string; lastSyncAt: Date | null }[];
  onboarding: { step: string; completedAt: Date | null; careerRole: string | null } | null;
  resumes: { uploadedAt: Date; sizeBytes: number | null }[];
}

export async function getStudentDetail(userId: string): Promise<StudentDetail | null> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId));

  if (!user) return null;

  // Account-level facts only (no file contents, no tokens). The evidence-level Student 360 lives in Student Intelligence.
  const [userConnections, [sessionCount], [onboarding], resumes] = await Promise.all([
    db.select({ sourceId: connections.sourceId, status: connections.status, lastSyncAt: connections.lastSyncAt }).from(connections).where(eq(connections.userId, userId)),
    db.select({ count: sql<number>`count(*)` }).from(sessions).where(eq(sessions.userId, userId)),
    db
      .select({ step: onboardingState.currentStep, completedAt: onboardingState.completedAt, careerRole: onboardingState.careerRole })
      .from(onboardingState)
      .where(eq(onboardingState.userId, userId)),
    db
      .select({ uploadedAt: files.createdAt, sizeBytes: files.sizeBytes })
      .from(files)
      .where(and(eq(files.userId, userId), eq(files.kind, "resume")))
      .orderBy(desc(files.createdAt))
      .limit(10),
  ]);

  return {
    ...user,
    activeSessionsCount: Number(sessionCount?.count ?? 0),
    linkedConnections: userConnections,
    onboarding: onboarding ?? null,
    resumes,
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
