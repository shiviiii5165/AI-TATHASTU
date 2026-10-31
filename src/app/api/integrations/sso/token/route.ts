import { createHash } from "node:crypto";

import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrationAuthCodes, users } from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientById } from "@/lib/integrations/clients";
import { getConsent, isLinked } from "@/lib/integrations/consent";
import { hashCode, mintAccessToken, pkceMatches, TOKEN_SCOPE } from "@/lib/integrations/tokens";
import { safeEqual } from "@/lib/internal-auth";
import { clientIp, hitRateLimit } from "@/lib/rate-limit";

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };
const oauthError = (status: number, error: string, description: string) =>
  NextResponse.json({ error, error_description: description }, { status, headers: NO_STORE });

/**
 * POST /api/integrations/sso/token — the app's server exchanges the one-time
 * code from /integrations/authorize for a 15-minute access token (ES256 JWT,
 * aud = the app). Server-to-server only: authenticated with the app's client
 * secret (HTTP Basic or client_id/client_secret in the body), no CORS.
 *
 * Body (form-encoded or JSON): grant_type=authorization_code, code,
 * redirect_uri (the same one used to authorize), code_verifier (if PKCE).
 */
export async function POST(request: Request) {
  // Server-to-server, so a real client stays far below this; it slows secret and code guessing.
  const ipHash = createHash("sha256").update(clientIp(request)).digest("hex").slice(0, 32);
  const limited = await hitRateLimit(`sso_token:${ipHash}`, { limit: 120, windowSeconds: 60 });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "slow_down", error_description: "Too many requests." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(limited.retryAfter) } },
    );
  }
  const body = await readBody(request);
  const [basicId, basicSecret] = basicCredentials(request.headers.get("authorization"));
  const client = clientById(basicId ?? body.client_id);
  if (!client || !client.secret || !safeEqual(basicSecret ?? body.client_secret, client.secret)) {
    return oauthError(401, "invalid_client", "Unknown client or wrong client secret.");
  }
  if (!(await isFeatureEnabled(client.flag))) return oauthError(403, "unauthorized_client", `${client.name} isn't enabled.`);
  if (body.grant_type !== "authorization_code") return oauthError(400, "unsupported_grant_type", "Use authorization_code.");
  if (!body.code || !body.redirect_uri) return oauthError(400, "invalid_request", "code and redirect_uri are required.");

  // Single use: the code is consumed by the same statement that reads it.
  const [grant] = await db
    .update(integrationAuthCodes)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(integrationAuthCodes.codeHash, hashCode(body.code)),
        eq(integrationAuthCodes.clientId, client.id),
        isNull(integrationAuthCodes.usedAt),
        gt(integrationAuthCodes.expiresAt, new Date()),
      ),
    )
    .returning();
  const invalid = () => oauthError(400, "invalid_grant", "The code is invalid, expired or already used.");
  if (!grant || grant.redirectUri !== body.redirect_uri) return invalid();
  if (grant.codeChallenge && !(body.code_verifier && pkceMatches(body.code_verifier, grant.codeChallenge))) return invalid();

  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.id, grant.userId));
  if (!user || user.deletedAt || !isLinked(await getConsent(user.id, client.id))) return invalid();

  const { token, expiresIn } = await mintAccessToken({ userId: user.id, email: user.email, name: user.name, clientId: client.id });
  return NextResponse.json(
    {
      access_token: token,
      token_type: "Bearer",
      expires_in: expiresIn,
      scope: TOKEN_SCOPE,
      user: { id: user.id, email: user.email, name: user.name },
    },
    { headers: NO_STORE },
  );
}

/** RFC 6749 §2.3.1: base64("<id>:<secret>"), split on the first colon, each part form-urlencoded. */
function basicCredentials(header: string | null): [string | undefined, string | undefined] {
  const encoded = header?.match(/^Basic\s+(.+)$/i)?.[1];
  if (!encoded) return [undefined, undefined];
  const decoded = Buffer.from(encoded, "base64").toString();
  const i = decoded.indexOf(":");
  if (i < 0) return [undefined, undefined];
  const unescape = (v: string) => {
    try {
      return decodeURIComponent(v.replace(/\+/g, " "));
    } catch {
      return v;
    }
  };
  return [unescape(decoded.slice(0, i)), unescape(decoded.slice(i + 1))];
}

async function readBody(request: Request): Promise<Record<string, string | undefined>> {
  const type = request.headers.get("content-type") ?? "";
  try {
    if (type.includes("application/json")) {
      const json = (await request.json()) as Record<string, unknown>;
      return Object.fromEntries(Object.entries(json).filter(([, v]) => typeof v === "string")) as Record<string, string>;
    }
    return Object.fromEntries(new URLSearchParams(await request.text()));
  } catch {
    return {};
  }
}
