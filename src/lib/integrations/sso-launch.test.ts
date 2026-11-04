/**
 * Central sign-in for Collaborate: prompt=none silent reuse, the dashboard
 * launch route, token signing failure, and issuer checks. Real handlers on
 * PGlite; only the Auth.js session is stubbed.
 */
import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
process.env.INTEGRATION_JWT_PRIVATE_KEY = JSON.stringify({ ...(await exportJWK(privateKey)), kid: "launch-test" });
process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET = "collab-secret-launch-0123456789abcdef";
process.env.INTEGRATION_COLLABORATE_REDIRECT_URIS = "https://collaborate.aitathastu.com/api/auth/tathastu/callback";

const h = vi.hoisted(() => ({ userId: null as string | null, failMint: false }));

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/auth", () => ({ auth: async () => (h.userId ? { user: { id: h.userId } } : null) }));
vi.mock("@/lib/integrations/tokens", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/integrations/tokens")>();
  return {
    ...real,
    mintAccessToken: async (...a: Parameters<typeof real.mintAccessToken>) => {
      if (h.failMint) throw new Error("INTEGRATION_JWT_PRIVATE_KEY is not set");
      return real.mintAccessToken(...a);
    },
  };
});

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { parseAuthorizeRequest, silentAuthorize } = await import("@/lib/integrations/authorize");
const { saveConsent, revokeLink } = await import("@/lib/integrations/consent");
const { verifyAccessToken, ISSUER } = await import("@/lib/integrations/tokens");
const tokenRoute = await import("@/app/api/integrations/sso/token/route");
const launchRoute = await import("@/app/integrations/launch/[client]/route");

const A = "00000000-0000-4000-8000-0000000000c1"; // linked to Collaborate
const B = "00000000-0000-4000-8000-0000000000c2"; // never approved Collaborate
const REDIRECT = "https://collaborate.aitathastu.com/api/auth/tathastu/callback";
const SECRET = process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET!;
const VERIFIER = "w".repeat(64);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const ALL_OFF = { education: false, skills: false, eris: false, projects: false, experience: false, achievements: false, activity: false };

const setFlag = (key: string, enabled: boolean) => db.update(schema.featureFlags).set({ enabled }).where(eq(schema.featureFlags.key, key));

async function silentReq(extra: Record<string, string> = {}) {
  const parsed = await parseAuthorizeRequest({
    client_id: "collaborate", redirect_uri: REDIRECT, state: "st-1", code_challenge: CHALLENGE, code_challenge_method: "S256", prompt: "none", ...extra,
  });
  if (!parsed.ok) throw new Error(parsed.message);
  return parsed.req;
}

const exchange = (code: string, extra: Record<string, string> = {}) =>
  tokenRoute.POST(new Request("https://www.aitathastu.com/api/integrations/sso/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: "collaborate", client_secret: SECRET, code_verifier: VERIFIER, ...extra,
    }).toString(),
  }));

const launch = (client: string) =>
  launchRoute.GET(new Request(`https://www.aitathastu.com/integrations/launch/${client}`), { params: Promise.resolve({ client }) });

beforeAll(async () => {
  await db.insert(schema.users).values([
    { id: A, name: "Asha", email: "asha@example.com" },
    { id: B, name: "Bala", email: "bala@example.com" },
  ]);
});
beforeEach(async () => {
  h.userId = null;
  h.failMint = false;
  await setFlag("collaborate_profile_api", true);
  await saveConsent(A, "collaborate", { scopes: { ...ALL_OFF, skills: true }, link: true });
});

describe("prompt=none (silent session reuse)", () => {
  it("is parsed as silent; other prompt values keep their old meaning", async () => {
    expect((await silentReq()).silent).toBe(true);
    const consent = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, code_challenge: CHALLENGE, code_challenge_method: "S256", prompt: "consent" });
    expect(consent).toMatchObject({ ok: true, req: { silent: false, forceConsent: true } });
    const other = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, code_challenge: CHALLENGE, code_challenge_method: "S256", prompt: "login" });
    expect(other).toMatchObject({ ok: true, req: { silent: false, forceConsent: false } });
  });

  it("signed out: login_required at the registered callback, with state", async () => {
    const url = new URL(await silentAuthorize(null, await silentReq()));
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT);
    expect(url.searchParams.get("error")).toBe("login_required");
    expect(url.searchParams.get("state")).toBe("st-1");
    expect(url.searchParams.get("code")).toBeNull();
  });

  it("never grants consent silently: an unapproved app gets consent_required", async () => {
    const url = new URL(await silentAuthorize(B, await silentReq()));
    expect(url.searchParams.get("error")).toBe("consent_required");
    expect(url.searchParams.get("code")).toBeNull();
  });

  it("a revoked link is treated as no consent", async () => {
    await revokeLink(A, "collaborate");
    expect(new URL(await silentAuthorize(A, await silentReq())).searchParams.get("error")).toBe("consent_required");
  });

  it("signed in and approved: a code that exchanges for a token (seamless re-authorization)", async () => {
    const url = new URL(await silentAuthorize(A, await silentReq()));
    expect(url.searchParams.get("state")).toBe("st-1");
    const code = url.searchParams.get("code")!;
    const res = await exchange(code);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(await verifyAccessToken(body.access_token)).toMatchObject({ userId: A, clientId: "collaborate" });
    expect((await exchange(code)).status).toBe(400); // still single use
  });

  it("an unregistered redirect_uri is never answered, even silently", async () => {
    const r = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: "https://evil.example/cb", prompt: "none", code_challenge: CHALLENGE, code_challenge_method: "S256" });
    expect(r).toMatchObject({ ok: false });
    expect((r as { redirect?: string }).redirect).toBeUndefined();
  });

  it("the flag still gates silent requests", async () => {
    await setFlag("collaborate_profile_api", false);
    const r = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, prompt: "none", code_challenge: CHALLENGE, code_challenge_method: "S256" });
    expect(r).toMatchObject({ ok: false, redirect: expect.stringContaining("error=temporarily_unavailable") });
  });
});

describe("GET /integrations/launch/<client>", () => {
  it("signed out: to login, coming back to the launch", async () => {
    const res = await launch("collaborate");
    expect(res.status).toBe(303);
    const loc = new URL(res.headers.get("location")!);
    expect(loc.pathname).toBe("/login");
    expect(loc.searchParams.get("callbackUrl")).toBe("/integrations/launch/collaborate");
  });

  it("signed in: to Collaborate's own OAuth start (no code, no secret in the URL)", async () => {
    h.userId = A;
    const res = await launch("collaborate");
    expect(res.status).toBe(303);
    const loc = res.headers.get("location")!;
    expect(loc).toBe("https://collaborate.aitathastu.com/api/auth/tathastu/start");
    expect(loc).not.toContain(SECRET);
  });

  it("app switched off: back to Integrations with a notice", async () => {
    h.userId = A;
    await setFlag("collaborate_profile_api", false);
    const loc = new URL((await launch("collaborate")).headers.get("location")!);
    expect(`${loc.pathname}${loc.search}`).toBe("/settings/integrations?unavailable=collaborate");
  });

  it("unknown app: 404, no redirect", async () => {
    h.userId = A;
    const res = await launch("evil");
    expect(res.status).toBe(404);
    expect(res.headers.get("location")).toBeNull();
  });
});

describe("token endpoint and verification hardening", () => {
  it("signing key unavailable: 503 temporarily_unavailable, not a crash", async () => {
    const code = new URL(await silentAuthorize(A, await silentReq())).searchParams.get("code")!;
    h.failMint = true;
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await exchange(code);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: "temporarily_unavailable" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    errors.mockRestore();
  });

  it("a token from our key with the wrong issuer is refused", async () => {
    const sign = (iss: string) =>
      new SignJWT({ scope: "profile:read" }).setProtectedHeader({ alg: "ES256", kid: "launch-test" }).setIssuer(iss)
        .setAudience("collaborate").setSubject(A).setIssuedAt().setExpirationTime("5m").sign(privateKey);
    expect(await verifyAccessToken(await sign(ISSUER))).toMatchObject({ userId: A });
    expect(await verifyAccessToken(await sign("https://evil.example"))).toBeNull();
  });

  it("wrong audience is refused", async () => {
    const t = await new SignJWT({ scope: "profile:read" }).setProtectedHeader({ alg: "ES256", kid: "launch-test" }).setIssuer(ISSUER)
      .setAudience("someone-else").setSubject(A).setIssuedAt().setExpirationTime("5m").sign(privateKey);
    expect(await verifyAccessToken(t)).toBeNull();
  });
});
