import "server-only";

import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";

export type RateLimit = {
  limit: number;
  windowSeconds: number;
  /**
   * If the database can't be reached. "local" (default) counts in this instance's
   * memory: weaker than the shared count, but the endpoint stays up and a burst is
   * still bounded. "deny" is for routes that spend money or reach third parties and
   * need the database anyway, where refusing costs nothing extra.
   */
  onDbError?: "local" | "deny";
};

const LIMITER_DEADLINE_MS = 1_500;
const LOCAL_MAX_KEYS = 10_000;
const localCounts = new Map<string, { windowStartS: number; count: number }>();

function hitLocal(key: string, windowStartS: number, limit: number) {
  const entry = localCounts.get(key);
  if (entry?.windowStartS === windowStartS) {
    entry.count += 1;
    return entry.count <= limit;
  }
  // Bounded: an attacker rotating keys can't grow this without limit.
  if (localCounts.size >= LOCAL_MAX_KEYS) localCounts.clear();
  localCounts.set(key, { windowStartS, count: 1 });
  return true;
}

/**
 * Fixed-window limiter in Postgres, so the count is shared by every serverless
 * instance. One atomic upsert per call.
 */
export async function hitRateLimit(key: string, { limit, windowSeconds, onDbError = "local" }: RateLimit): Promise<{ ok: boolean; retryAfter: number }> {
  const nowS = Math.floor(Date.now() / 1000);
  const windowStartS = nowS - (nowS % windowSeconds);
  const windowStart = new Date(windowStartS * 1000);
  const retryAfter = windowStartS + windowSeconds - nowS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const upsert = db
      .insert(rateLimits)
      .values({ key, windowStart, count: 1 })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`case when ${rateLimits.windowStart} = excluded.window_start then ${rateLimits.count} + 1 else 1 end`,
          windowStart: sql`excluded.window_start`,
        },
      })
      .returning({ count: rateLimits.count })
      .then((rows) => rows);
    upsert.catch(() => {}); // It may fail after the deadline below has already answered.
    // A slow database must not add its full query deadline to every request just to
    // count it: the limiter would become the bottleneck. "deny" routes need the database
    // to finish anyway, so they wait for the query's own deadline.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("rate limiter timed out")), LIMITER_DEADLINE_MS);
    });
    const [row] = onDbError === "deny" ? await upsert : await Promise.race([upsert, deadline]);
    return { ok: (row?.count ?? 1) <= limit, retryAfter };
  } catch (error) {
    console.error("rate limiter unavailable", { key: key.split(":")[0], onDbError, error: String(error) });
    return { ok: onDbError === "local" && hitLocal(key, windowStartS, limit), retryAfter };
  } finally {
    clearTimeout(timer);
  }
}

let proxyWarningLogged = false;

/**
 * Derives a reliable client rate-limiting identifier.
 *
 * 1. On trusted edges (Vercel or explicit TRUST_PROXY_HEADERS=1), extracts the client IP
 *    from edge-verified headers (x-vercel-forwarded-for, x-forwarded-for first hop, x-real-ip, or cf-connecting-ip).
 * 2. Off-Vercel without trusted reverse proxy configuration, client-supplied forwarding headers
 *    are NEVER blindly trusted (preventing spoofed X-Forwarded-For bypass).
 * 3. To prevent independent users from unintentionally sharing a global "unknown" rate-limit
 *    bucket (which would allow one user to DoS all others), unverified callers are partitioned
 *    using non-spoofable client entropy (cookie, authorization, user-agent, accept-language).
 */
export function clientIp(request: Request): string {
  const { headers } = request;
  const isVercel = Boolean(process.env.VERCEL);
  const trustProxy = process.env.TRUST_PROXY_HEADERS === "1";

  if (isVercel || trustProxy) {
    const trustedIp =
      (isVercel ? headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null) ||
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip") ||
      headers.get("cf-connecting-ip")?.trim();

    if (trustedIp) return trustedIp;
  }

  if (!isVercel && !trustProxy && process.env.NODE_ENV === "production" && !proxyWarningLogged) {
    proxyWarningLogged = true;
    console.warn(
      "[rate-limit] Running off-Vercel in production without TRUST_PROXY_HEADERS=1. " +
      "Client IPs fall back to client fingerprint partitioning. " +
      "Set TRUST_PROXY_HEADERS=1 behind a trusted reverse proxy (see DEPLOYMENT.md)."
    );
  }

  // Derive isolated partition for unverified client without trusting client-supplied IP headers
  const clientEntropy = [
    headers.get("cookie"),
    headers.get("authorization"),
    headers.get("user-agent"),
    headers.get("accept-language"),
  ]
    .filter(Boolean)
    .join("|");

  if (clientEntropy) {
    const hash = createHash("sha256").update(clientEntropy).digest("hex").slice(0, 16);
    return `untrusted:${hash}`;
  }

  return "unknown";
}
