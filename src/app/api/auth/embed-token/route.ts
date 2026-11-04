import { connection, NextResponse } from "next/server";

import { auth } from "@/auth";
import { liveSessionVersion } from "@/lib/auth/account-lock";
import { isAllowedEmbedOrigin, isEmbedConfigured, mintEmbedToken } from "@/lib/embed-token";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { hitRateLimit } from "@/lib/rate-limit";

/**
 * GET /api/auth/embed-token?origin=https://pilot.example — mints a 15-minute,
 * read-only token for the signed-in user, bound to that pilot-site origin.
 *
 * Session cookie only (an embed token can't mint another). No CORS headers:
 * only same-origin pages can read the response; the pilot site receives the
 * token through the /embed/authorize popup's postMessage instead.
 */
export async function GET(request: Request) {
  await connection();
  const headers = { "Cache-Control": "no-store" };
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers });

  const limited = await hitRateLimit(`embed_token:${session.user.id}`, { limit: 60, windowSeconds: 3600, onDbError: "deny" });
  if (!limited.ok) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { ...headers, "Retry-After": String(limited.retryAfter) } });

  const origin = new URL(request.url).searchParams.get("origin");
  if (!isAllowedEmbedOrigin(origin)) return NextResponse.json({ error: "origin_not_allowed" }, { status: 400, headers });
  if (!isEmbedConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503, headers });
  if (!(await isFeatureEnabled("pilot_site_embed"))) return NextResponse.json({ error: "disabled" }, { status: 403, headers });

  const sessionVersion = await liveSessionVersion(session.user.id);
  if (sessionVersion === null) return NextResponse.json({ error: "unauthenticated" }, { status: 401, headers });
  const { token, expiresAt } = await mintEmbedToken(session.user.id, origin, sessionVersion);
  return NextResponse.json({ token, expiresAt, origin, tokenType: "Bearer" }, { headers });
}
