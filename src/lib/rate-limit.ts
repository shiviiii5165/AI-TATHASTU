import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimit = { limit: number; windowSeconds: number };

/**
 * Fixed-window limiter in Postgres, so the count is shared by every serverless
 * instance. One atomic upsert per call. If the database is unreachable the
 * request is allowed (fail open, logged): auth and consent are enforced
 * separately, and a rate limiter must not take the endpoint down with it.
 */
export async function hitRateLimit(key: string, { limit, windowSeconds }: RateLimit): Promise<{ ok: boolean; retryAfter: number }> {
  const nowS = Math.floor(Date.now() / 1000);
  const windowStartS = nowS - (nowS % windowSeconds);
  const windowStart = new Date(windowStartS * 1000);
  try {
    const [row] = await db
      .insert(rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.windowStart} = excluded.window_start then ${rateLimits.count} + 1 else 1 end`,
          windowStart: sql`excluded.window_start`,
        },
      })
      .returning({ count: rateLimits.count });
    const retryAfter = windowStartS + windowSeconds - nowS;
    return { ok: (row?.count ?? 1) <= limit, retryAfter };
  } catch (error) {
    console.error("rate limiter unavailable; allowing request", { key: key.split(":")[0], error: String(error) });
    return { ok: true, retryAfter: 0 };
  }
}

/** First hop of x-forwarded-for (set by Vercel's edge), else x-real-ip. */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}
