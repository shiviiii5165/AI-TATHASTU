import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { db } from "@/db";
import { liveSessionVersion } from "@/lib/auth/account-lock";
import { users } from "@/db/schema";
import { isAllowedEmbedOrigin, verifyEmbedToken } from "@/lib/embed-token";
import { isFeatureEnabled, MODULE_FLAGS } from "@/lib/feature-flags";
import { loadProfile, toEmbedV1, toProfileV1 } from "@/lib/profile/unified";
import { hitRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/profile/v1/me — the read-only profile contract (spec:
 * public/api/profile/openapi.json). Two ways in:
 *
 *  1. Session cookie (modules on the same domain). The caller declares its
 *     module (X-AIT-Module header or ?module=); that module's feature flag
 *     must be on. Returns the full ProfileV1 contract.
 *  2. Authorization: Bearer <embed token> (pilot site, plan §4.3). Gated by
 *     pilot_site_embed; returns only the compact EmbedV1 view. CORS is
 *     allowed for EMBED_ALLOWED_ORIGINS.
 *
 * Every response is for the authenticated user only: there is no user
 * parameter to tamper with, and the token's subject is cryptographically bound.
 */
export async function GET(request: Request) {
  await connection();
  const origin = request.headers.get("origin");
  const cors = corsHeaders(origin);
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];

  try {
    if (bearer) {
      const claims = await verifyEmbedToken(bearer, origin);
      if (!claims) return error(401, "invalid_token", "The embed token is invalid or expired.", cors);
      if (!(await withinLimit(claims.userId))) return error(429, "rate_limited", "Too many requests.", cors);
      if (!(await isFeatureEnabled("pilot_site_embed"))) return error(403, "disabled", "The embed isn't enabled.", cors);
      // A revoked session takes its embed tokens with it, not 15 minutes later.
      if ((await liveSessionVersion(claims.userId)) !== claims.sessionVersion) return error(401, "invalid_token", "The embed token is no longer valid.", cors);
      return respond(request, toEmbedV1(await loadProfile(claims.userId), new URL(request.url).origin), cors);
    }

    const session = await auth();
    if (!session?.user?.id) return error(401, "unauthenticated", "Sign in to continue.", cors);
    if (!(await withinLimit(session.user.id))) return error(429, "rate_limited", "Too many requests.", cors);
    const moduleName = (request.headers.get("x-ait-module") ?? new URL(request.url).searchParams.get("module") ?? "").toLowerCase();
    const flag = MODULE_FLAGS[moduleName];
    if (!flag) {
      return error(400, "module_required", `Send X-AIT-Module: one of ${Object.keys(MODULE_FLAGS).join(", ")}.`, cors);
    }
    if (!(await isFeatureEnabled(flag))) return error(403, "disabled", `The profile API isn't enabled for ${moduleName}.`, cors);
    if (!(await activeUser(session.user.id))) return error(401, "unauthenticated", "Sign in to continue.", cors);
    return respond(request, toProfileV1(await loadProfile(session.user.id)), cors);
  } catch (err) {
    console.error("profile v1: load failed", err);
    return NextResponse.json(
      { error: "unavailable", message: "Profile is temporarily unavailable." },
      { status: 503, headers: { ...NO_STORE, ...cors, "Retry-After": "30" } },
    );
  }
}

/** CORS preflight for the embed's Bearer requests. */
export function OPTIONS(request: Request) {
  const cors = corsHeaders(request.headers.get("origin"));
  return new NextResponse(null, { status: cors["Access-Control-Allow-Origin"] ? 204 : 403, headers: cors });
}

async function withinLimit(userId: string) {
  return (await hitRateLimit(`profile_me:${userId}`, { limit: 120, windowSeconds: 60 })).ok;
}

async function activeUser(id: string) {
  const [user] = await db.select({ deletedAt: users.deletedAt }).from(users).where(eq(users.id, id));
  return Boolean(user && !user.deletedAt);
}

function respond(request: Request, payload: unknown, cors: Record<string, string>) {
  const body = JSON.stringify(payload);
  const etag = `W/"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { ...NO_STORE, ...cors, ETag: etag, "X-Profile-API-Version": "1" };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
}

function error(status: number, code: string, message: string, cors: Record<string, string>) {
  return NextResponse.json({ error: code, message }, { status, headers: { ...NO_STORE, ...cors } });
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!isAllowedEmbedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, If-None-Match",
    "Access-Control-Expose-Headers": "ETag, X-Profile-API-Version",
    "Access-Control-Max-Age": "600",
  };
}

// Personal data: never cached by shared caches; revalidate with the ETag.
const NO_STORE = { "Cache-Control": "private, no-cache", Vary: "Cookie, Authorization, Origin" };
