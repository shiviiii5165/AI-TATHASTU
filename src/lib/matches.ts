import "server-only";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { consents, institutions, matches, onboardingState, users } from "@/db/schema";
import { CAREER_ROLES } from "@/lib/onboarding/catalog";

export type MatchCard = {
  studentId: string;
  name: string;
  role: string | null;
  university: string | null;
  score: number;
  reasons: string[];
};

/**
 * A mentor's (faculty or alum) matched students, best first. Only students
 * whose latest `mentor_discovery` consent is granted are returned; the rest
 * are counted, never shown.
 */
export async function matchesForMentor(mentorId: string, limit = 5): Promise<{ visible: MatchCard[]; hidden: number }> {
  // One query: each match plus the student's latest mentor_discovery answer.
  const consented = sql<boolean>`coalesce((
    select ${consents.granted} from ${consents}
     where ${consents.userId} = ${matches.studentId} and ${consents.purpose} = 'mentor_discovery'
     order by ${consents.createdAt} desc limit 1), false)`;
  const rows = await db
    .select({
      studentId: matches.studentId,
      score: matches.score,
      reasons: matches.reasons,
      name: users.name,
      university: institutions.canonicalName,
      legacyUniversity: users.university,
      role: onboardingState.careerRole,
      consented,
    })
    .from(matches)
    .innerJoin(users, and(eq(users.id, matches.studentId), isNull(users.deletedAt)))
    .leftJoin(institutions, eq(institutions.id, users.institutionId))
    .leftJoin(onboardingState, eq(onboardingState.userId, users.id))
    .where(eq(matches.mentorId, mentorId))
    .orderBy(desc(matches.score));

  const discoverable = rows.filter((r) => r.consented === true);
  return {
    visible: discoverable.slice(0, limit).map((r) => ({
      studentId: r.studentId,
      name: r.name ?? "A student",
      role: CAREER_ROLES.find((c) => c.id === r.role)?.label ?? null,
      university: r.university ?? r.legacyUniversity,
      score: r.score,
      reasons: r.reasons.slice(0, 2),
    })),
    hidden: rows.length - discoverable.length,
  };
}
