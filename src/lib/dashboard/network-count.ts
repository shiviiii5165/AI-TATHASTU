import "server-only";

import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { collaborationEmbeddings as ce, users } from "@/db/schema";
import { discoverableBy, isMentor, type Viewer } from "@/lib/discovery";

// How many people a viewer can discover, shown on every dashboard. The count depends only
// on whether the viewer is a mentor, so one number per audience is shared. It holds no
// identities, so sharing it across users exposes nothing. It may lag by TTL_MS (a consent
// change shows in the number within 5 minutes; the people lists themselves are never cached).
const TTL_MS = 5 * 60_000;
// Matches no account, so the shared count excludes nobody; the viewer is subtracted below.
const NO_ONE = "00000000-0000-0000-0000-000000000000";

type Audience = "mentor" | "student";
type Entry = { value: number; expires: number };

const cached = new Map<Audience, Entry>();
const inFlight = new Map<Audience, Promise<number>>();

function audienceCount(audience: Audience): Promise<number> {
  const entry = cached.get(audience);
  if (entry && entry.expires > Date.now()) return Promise.resolve(entry.value);

  // Single flight: an expired entry triggers one query per instance, however many requests wait.
  let pending = inFlight.get(audience);
  if (!pending) {
    pending = Promise.resolve()
      .then(() =>
        db
          .select({ n: count() })
          .from(ce)
          .innerJoin(users, eq(users.id, ce.userId))
          .where(discoverableBy({ id: NO_ONE, role: audience === "mentor" ? "faculty" : "student" })),
      )
      .then(([row]) => {
        const value = row?.n ?? 0;
        cached.set(audience, { value, expires: Date.now() + TTL_MS });
        return value;
      })
      .catch((error) => {
        // An old count beats failing the whole dashboard over one number.
        if (entry) return entry.value;
        throw error;
      })
      .finally(() => inFlight.delete(audience));
    inFlight.set(audience, pending);
  }
  return pending;
}

export async function discoverableCount(viewer: Viewer): Promise<number> {
  if (!isMentor(viewer.role)) return audienceCount("student");
  // Mentors are themselves in the mentor audience's count; nobody discovers themselves.
  const [total, [self]] = await Promise.all([
    audienceCount("mentor"),
    db.select({ n: count() }).from(ce).where(eq(ce.userId, viewer.id)),
  ]);
  return Math.max(0, total - (self?.n ? 1 : 0));
}

/** For tests. */
export function resetDiscoverableCount() {
  cached.clear();
  inFlight.clear();
}
