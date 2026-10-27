import "server-only";

import { and, inArray, isNull, ne, or, sql, type SQL } from "drizzle-orm";

import { consents, users, type Persona } from "@/db/schema";

export type Viewer = { id: string; role: Persona };

const MENTOR_ROLES: Persona[] = ["faculty", "alumni"];

export const isMentor = (role: Persona) => MENTOR_ROLES.includes(role);

/**
 * Which other accounts `viewer` may see in people lists, matches, Yora and
 * search. Follows the mentor_discovery consent copy (src/lib/consent/catalog.ts):
 * faculty and alumni are always findable; a student is findable only by
 * faculty and alumni, and only while their latest mentor_discovery row is
 * granted (so revoking takes effect at once). Deleted accounts and the viewer
 * are never returned.
 *
 * Correlated on the unaliased `users` table: use it in queries that select
 * from or join `users` without an alias.
 */
export function discoverableBy(viewer: Viewer): SQL {
  const mentorTarget = inArray(users.role, MENTOR_ROLES);
  const studentConsented = sql`coalesce((
    select ${consents.granted} from ${consents}
     where ${consents.userId} = ${users.id} and ${consents.purpose} = 'mentor_discovery'
     order by ${consents.createdAt} desc limit 1), false)`;
  return and(
    ne(users.id, viewer.id),
    isNull(users.deletedAt),
    isMentor(viewer.role) ? or(mentorTarget, studentConsented) : mentorTarget,
  )!;
}
