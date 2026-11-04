import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { connection, NextResponse } from "next/server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientById } from "@/lib/integrations/clients";
import { getConsent, isLinked } from "@/lib/integrations/consent";
import { toProfessionalProjectionV1 } from "@/lib/integrations/projection";
import { verifyAccessToken } from "@/lib/integrations/tokens";
import { loadProfile } from "@/lib/profile/unified";
import { hitRateLimit } from "@/lib/rate-limit";

const HEADERS = { "Cache-Control": "private, no-store", Vary: "Authorization" };
const error = (status: number, code: string, message: string) =>
  NextResponse.json({ error: code, message }, { status, headers: { ...HEADERS, ...(status === 401 ? { "WWW-Authenticate": "Bearer" } : {}) } });

/**
 * GET /api/integrations/v1/profile — ProfessionalProjectionV1 for the user in
 * the Bearer token, filtered by what they agreed to share with the token's
 * audience. Server-to-server (no CORS). There is no user parameter: the
 * token's subject is the only user this can ever return.
 */
export async function GET(request: Request) {
  await connection();
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  const claims = bearer ? await verifyAccessToken(bearer) : null;
  if (!claims) return error(401, "invalid_token", "Missing, invalid or expired access token.");

  const limited = await hitRateLimit(`integration_profile:${claims.clientId}:${claims.userId}`, { limit: 120, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...HEADERS, "Retry-After": String(limited.retryAfter) } });
  }

  const client = clientById(claims.clientId)!;
  if (!(await isFeatureEnabled(client.flag))) return error(403, "disabled", `${client.name} isn't enabled.`);

  try {
    const [user] = await db.select({ deletedAt: users.deletedAt, sessionVersion: users.sessionVersion }).from(users).where(eq(users.id, claims.userId));
    const consent = await getConsent(claims.userId, client.id);
    // Disconnecting the app or revoking the user's sessions invalidates its tokens immediately, not after 15 minutes.
    if (!user || user.deletedAt || user.sessionVersion !== claims.sessionVersion || !isLinked(consent)) {
      return error(401, "invalid_token", "The user disconnected this app.");
    }

    const body = JSON.stringify(toProfessionalProjectionV1(await loadProfile(claims.userId), client.id, consent));
    const etag = `W/"${createHash("sha1").update(body.replace(/"generatedAt":"[^"]*"/, "")).digest("base64url")}"`;
    if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers: { ...HEADERS, ETag: etag } });
    return new NextResponse(body, { headers: { ...HEADERS, ETag: etag, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("integrations profile: load failed", err);
    return NextResponse.json({ error: "unavailable" }, { status: 503, headers: { ...HEADERS, "Retry-After": "30" } });
  }
}
