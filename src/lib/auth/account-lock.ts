import "server-only";

import { eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema";

/**
 * Whether this sign-in would land on an account being deleted. By id AND address: for an
 * identity not linked yet, Auth.js passes the provider's user, whose id means nothing, and
 * Google's email linking would then attach it to the tombstoned row.
 */
export async function isSignInLocked(user: { id?: string | null; email?: string | null }) {
  const email = user.email?.toLowerCase().trim();
  const matches = [
    ...(user.id && /^[0-9a-f-]{36}$/i.test(user.id) ? [eq(users.id, user.id)] : []),
    ...(email ? [sql`lower(${users.email}) = ${email}`] : []),
  ];
  if (!matches.length) return false;
  const rows = await db.select({ deletedAt: users.deletedAt }).from(users).where(or(...matches));
  return rows.some((row) => row.deletedAt !== null);
}

/**
 * The session version of an account that may hold a session; null if it's gone or being
 * deleted. Runs on every auth(), so no route using it, however bare, can serve a deleted user.
 */
export async function liveSessionVersion(userId: string) {
  const [row] = await db.select({ version: users.sessionVersion, deletedAt: users.deletedAt }).from(users).where(eq(users.id, userId));
  return row && !row.deletedAt ? row.version : null;
}
