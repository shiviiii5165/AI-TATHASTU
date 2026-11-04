import "server-only";

import { jwtVerify, SignJWT } from "jose";

/**
 * Scoped token for the pilot-site embed (plan §4.3): read-only, 15 minutes,
 * signed with EMBED_JWT_SECRET (never the session secret), and bound to the
 * pilot site's origin. Only minted for a signed-in user via the session
 * cookie, so a token can't be used to mint another.
 */

const ISSUER = "aitathastu";
const AUDIENCE = "ait-embed";
export const EMBED_SCOPE = "profile:read:embed";
export const EMBED_TTL_SECONDS = 15 * 60;

function secret(): Uint8Array {
  const raw = process.env.EMBED_JWT_SECRET ?? "";
  if (raw.length < 32) throw new Error("EMBED_JWT_SECRET must be at least 32 characters");
  if (raw === process.env.AUTH_SECRET) throw new Error("EMBED_JWT_SECRET must differ from AUTH_SECRET");
  return new TextEncoder().encode(raw);
}

export function isEmbedConfigured() {
  try {
    secret();
    return true;
  } catch {
    return false;
  }
}

/** Origins allowed to receive embed tokens (EMBED_ALLOWED_ORIGINS, comma-separated). */
export function allowedEmbedOrigins(): string[] {
  return (process.env.EMBED_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

export function isAllowedEmbedOrigin(origin: string | null | undefined): origin is string {
  return Boolean(origin) && allowedEmbedOrigins().includes(origin!.replace(/\/$/, ""));
}

export async function mintEmbedToken(userId: string, origin: string, sessionVersion = 0) {
  const expiresAt = Math.floor(Date.now() / 1000) + EMBED_TTL_SECONDS;
  const token = await new SignJWT({ scope: EMBED_SCOPE, origin, sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(secret());
  return { token, expiresAt };
}

export type EmbedClaims = { userId: string; origin: string; sessionVersion: number };

/** Claims if the token is valid, unexpired, correctly scoped and (when the browser sent one) used from its origin; else null. */
export async function verifyEmbedToken(token: string, requestOrigin: string | null): Promise<EmbedClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"], requiredClaims: ["exp", "sub"] });
    if (payload.scope !== EMBED_SCOPE || typeof payload.sub !== "string" || typeof payload.origin !== "string") return null;
    if (requestOrigin && requestOrigin !== payload.origin) return null;
    return { userId: payload.sub, origin: payload.origin, sessionVersion: typeof payload.sv === "number" ? payload.sv : 0 };
  } catch {
    return null;
  }
}
