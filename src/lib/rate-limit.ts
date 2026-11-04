import "server-only";

import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimits } from "@/db/schema";
import { normalizeIp } from "@/lib/ip";

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

/**
 * For work that costs money: no span of windowSeconds holds more than `limit`, at any
 * boundary, unlike the fixed window above. Refused if the database can't be reached.
 */
export async function hitSlidingLimit(key: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; retryAfter: number }> {
  try {
    const { rows } = await db.execute(sql`SELECT hit_sliding_limit(${key}::text, ${limit}::int, ${windowSeconds}::int) AS retry`);
    const retry = Number((rows[0] as { retry: number }).retry);
    return { ok: retry === 0, retryAfter: retry };
  } catch (error) {
    console.error("sliding limiter unavailable", { key: key.split(":")[0], error: String(error) });
    return { ok: false, retryAfter: 60 };
  }
}

let proxyWarningLogged = false;

export type ClientIdentity =
  | {
      ok: true;
      /** Normalized IP address (RFC 5952 for IPv6, canonical dotted-decimal for IPv4). */
      ip: string;
      /**
       * Rate-limiting bucket key:
       * - IPv4: dotted-decimal (e.g. "192.0.2.1")
       * - IPv6: /64 prefix (e.g. "2001:db8:abcd:12::/64") to group privacy rotation addresses
       */
      bucketKey: string;
      version: 4 | 6;
    }
  | {
      ok: false;
      reason: "missing" | "untrusted" | "malformed";
    };

/**
 * Resolves verified client identity using platform-trusted proxy infrastructure:
 *
 * 1. On Vercel (process.env.VERCEL is set):
 *    Extracts client IP from `x-vercel-forwarded-for` (platform-managed header that strips
 *    incoming client copies), falling back to `x-forwarded-for` first hop.
 * 2. On custom hosting (process.env.TRUST_PROXY_HEADERS === "1"):
 *    Extracts client IP only when explicitly configured behind a verified reverse proxy
 *    that overwrites forwarding headers (e.g. Nginx, Cloudflare).
 * 3. Off-Vercel without TRUST_PROXY_HEADERS=1:
 *    Forwarding headers are NEVER trusted, preventing spoofed header bypass.
 *    Returns `{ ok: false, reason: "untrusted" }`.
 *
 * All extracted IP addresses are validated and normalized with `normalizeIp`. Malformed values
 * are rejected. Arbitrary headers, user-agents, and cookies are never used as client identity.
 */
export function resolveClientIdentity(request: Request): ClientIdentity {
  const { headers } = request;
  const isVercel = Boolean(process.env.VERCEL);
  const trustProxy = process.env.TRUST_PROXY_HEADERS === "1";

  if (isVercel) {
    // Vercel edge sets x-vercel-forwarded-for to the connecting client IP.
    // If chained, the first IP is the client.
    const vercelHeader = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    const fallbackHeader = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const rawIp = vercelHeader || fallbackHeader;

    if (!rawIp) {
      return { ok: false, reason: "missing" };
    }

    const normalized = normalizeIp(rawIp);
    if (!normalized) {
      return { ok: false, reason: "malformed" };
    }

    return {
      ok: true,
      ip: normalized.normalized,
      bucketKey: normalized.bucketKey,
      version: normalized.version,
    };
  }

  if (trustProxy) {
    // Custom hosting: operator explicitly guarantees proxy overwrites forwarding headers.
    const rawIp =
      headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headers.get("x-real-ip")?.trim() ||
      headers.get("cf-connecting-ip")?.trim();

    if (!rawIp) {
      return { ok: false, reason: "missing" };
    }

    const normalized = normalizeIp(rawIp);
    if (!normalized) {
      return { ok: false, reason: "malformed" };
    }

    return {
      ok: true,
      ip: normalized.normalized,
      bucketKey: normalized.bucketKey,
      version: normalized.version,
    };
  }

  // Off-Vercel without TRUST_PROXY_HEADERS=1: direct or unverified proxy connection.
  const hasForwardingHeaders = Boolean(
    headers.get("x-forwarded-for") ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-vercel-forwarded-for")
  );

  if (hasForwardingHeaders && process.env.NODE_ENV === "production" && !proxyWarningLogged) {
    proxyWarningLogged = true;
    console.warn(
      "[rate-limit] Received forwarding headers off-Vercel without TRUST_PROXY_HEADERS=1. " +
      "Client-supplied headers ignored to prevent spoofing bypass. " +
      "Set TRUST_PROXY_HEADERS=1 only behind a verified reverse proxy (see DEPLOYMENT.md)."
    );
  }

  return { ok: false, reason: "untrusted" };
}

/**
 * Returns the verified client IP bucket key for rate limiting, or null if no
 * trustworthy client IP could be established.
 *
 * NEVER returns "unknown" or weak client header fingerprints, eliminating global
 * bucket collisions and spoofing bypass.
 */
export function clientIp(request: Request): string | null {
  const identity = resolveClientIdentity(request);
  return identity.ok ? identity.bucketKey : null;
}

/**
 * Privacy-preserving 32-character SHA-256 hash of the client IP bucket key.
 * Guarantees that raw IP addresses are never logged or stored in the database.
 * Returns null if client IP is unverified.
 */
export function clientIpHash(request: Request): string | null {
  const ip = clientIp(request);
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
