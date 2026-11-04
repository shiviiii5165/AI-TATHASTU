/**
 * External integrations (Collaborate, Meet): the OAuth code → token exchange,
 * token audience/signature checks, consent masking in
 * ProfessionalProjectionV1, revocation, and the webhook outbox.
 * Real route handlers on PGlite; only outbound fetch is stubbed.
 */
import { createHash, createHmac } from "node:crypto";

import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
process.env.INTEGRATION_JWT_PRIVATE_KEY = JSON.stringify({ ...(await exportJWK(privateKey)), kid: "test-key" });
process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET = "collab-secret-0123456789abcdef0123";
process.env.INTEGRATION_COLLABORATE_REDIRECT_URIS = "https://collaborate.aitathastu.com/auth/callback";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.aitathastu.com/webhooks/ait";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "whsec-collab-0123456789";
process.env.INTEGRATION_MEET_CLIENT_SECRET = "meet-secret-0123456789abcdef012345";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const tokenRoute = await import("@/app/api/integrations/sso/token/route");
const profileRoute = await import("@/app/api/integrations/v1/profile/route");
const { issueCode, parseAuthorizeRequest } = await import("@/lib/integrations/authorize");
const { saveConsent, revokeLink } = await import("@/lib/integrations/consent");
const { projectKey } = await import("@/lib/integrations/projection");
const { dispatchWebhooks, enqueueProfileUpdated, enqueueRevoked } = await import("@/lib/integrations/webhooks");
const { mintAccessToken } = await import("@/lib/integrations/tokens");

const A = "00000000-0000-4000-8000-0000000000a1";
const B = "00000000-0000-4000-8000-0000000000b2";
const REDIRECT = "https://collaborate.aitathastu.com/auth/callback";
const ALL_OFF = { education: false, skills: false, eris: false, projects: false, experience: false, achievements: false, activity: false };

async function seed(id: string, name: string) {
  await db.insert(schema.users).values({ id, name, email: `${name.toLowerCase()}@example.com`, city: "Pune", country: "India" });
  await db.insert(schema.onboardingState).values({ userId: id, currentStep: "done", careerRole: "ml_engineer" });
  await db.insert(schema.profileFacts).values([
    { userId: id, fieldGroup: "identity", fieldName: "full_name", extractedValue: name, normalizedValue: name, origin: "user_entered", confirmation: "confirmed" },
    { userId: id, fieldGroup: "education", fieldName: "institution", recordKey: "e1", extractedValue: `${name} Institute`, origin: "resume", confirmation: "confirmed" },
    { userId: id, fieldGroup: "certifications", fieldName: "name", recordKey: "c1", extractedValue: "Deep Learning", origin: "resume", confirmation: "confirmed" },
  ]);
  await db.insert(schema.unifiedProjects).values([
    { userId: id, canonicalTitle: `${name} Public Project`, technologies: ["Python"] },
    { userId: id, canonicalTitle: `${name} Secret Project`, technologies: ["Rust"] },
  ]);
  await db.insert(schema.profileViews).values({
    userId: id,
    view: {
      version: 1, computedAt: new Date().toISOString(),
      skills: [{ name: "PyTorch", category: "ml", evidenceStrength: 0.9, sources: ["github"], verificationStatus: "verified" }],
      erisScore: { overall: 0.63, byRole: { ml_engineer: 0.63 }, gaps: [] },
      readinessIndicators: {},
    },
  });
}

async function setFlag(key: string, enabled: boolean) {
  await db.update(schema.featureFlags).set({ enabled }).where(eq(schema.featureFlags.key, key));
}

const exchange = (body: Record<string, string>) =>
  tokenRoute.POST(new Request("https://www.aitathastu.com/api/integrations/sso/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  }));

const getProfile = (token: string) =>
  profileRoute.GET(new Request("https://www.aitathastu.com/api/integrations/v1/profile", { headers: { authorization: `Bearer ${token}` } }));

const VERIFIER = "v".repeat(50);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");

async function codeFor(userId: string, extra: Record<string, string> = {}) {
  const parsed = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, state: "s1", code_challenge: CHALLENGE, code_challenge_method: "S256", ...extra });
  if (!parsed.ok) throw new Error(parsed.message);
  return new URL(await issueCode(userId, parsed.req)).searchParams.get("code")!;
}

const goodExchange = (code: string, extra: Record<string, string> = {}) =>
  exchange({
    grant_type: "authorization_code", code, redirect_uri: REDIRECT,
    client_id: "collaborate", client_secret: process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET!, code_verifier: VERIFIER, ...extra,
  });

beforeAll(async () => {
  await seed(A, "Alice");
  await seed(B, "Bob");
});
beforeEach(async () => {
  await setFlag("collaborate_profile_api", true);
  await setFlag("meet_profile_api", true);
  await saveConsent(A, "collaborate", { scopes: { ...ALL_OFF, skills: true, projects: true, education: true }, hiddenProjects: [], link: true });
});
afterEach(() => vi.unstubAllGlobals());

describe("authorize request validation", () => {
  it("never redirects to an unregistered return address", async () => {
    const r = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: "https://evil.example/cb", state: "x" });
    expect(r).toMatchObject({ ok: false });
    expect((r as { redirect?: string }).redirect).toBeUndefined();
  });
  it("rejects unknown apps and non-S256 PKCE", async () => {
    expect(await parseAuthorizeRequest({ client_id: "nope", redirect_uri: REDIRECT })).toMatchObject({ ok: false });
    const plain = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, code_challenge: "x".repeat(43), code_challenge_method: "plain" });
    expect(plain).toMatchObject({ ok: false, redirect: expect.stringContaining("error=invalid_request") });
  });
});

describe("POST /api/integrations/sso/token", () => {
  it("exchanges a code once for a 15-minute ES256 token for that app", async () => {
    const code = await codeFor(A);
    const res = await goodExchange(code);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ token_type: "Bearer", expires_in: 900, user: { id: A, email: "alice@example.com" } });
    const [header, payload] = body.access_token.split(".").slice(0, 2).map((p: string) => JSON.parse(Buffer.from(p, "base64url").toString()));
    expect(header).toMatchObject({ alg: "ES256", kid: "test-key" });
    expect(payload).toMatchObject({ aud: "collaborate", sub: A, email: "alice@example.com" });
    expect(payload.exp - payload.iat).toBe(900);

    expect((await goodExchange(code)).status).toBe(400); // single use
  });

  it("rejects a wrong secret, another app's secret, or a different redirect_uri", async () => {
    const code = await codeFor(A);
    expect((await goodExchange(code, { client_secret: "wrong" })).status).toBe(401);
    expect((await goodExchange(code, { client_id: "meet", client_secret: process.env.INTEGRATION_MEET_CLIENT_SECRET! })).status).toBe(400);
    const code2 = await codeFor(A);
    expect((await goodExchange(code2, { redirect_uri: "https://collaborate.aitathastu.com/other" })).status).toBe(400);
  });

  it("enforces PKCE when the app used it", async () => {
    const verifier = "v".repeat(50);
    const challenge = (await import("node:crypto")).createHash("sha256").update(verifier).digest("base64url");
    const code = await codeFor(A, { code_challenge: challenge, code_challenge_method: "S256" });
    expect((await goodExchange(code, { code_verifier: "wrong".repeat(10) })).status).toBe(400);
    const code2 = await codeFor(A, { code_challenge: challenge, code_challenge_method: "S256" });
    expect((await goodExchange(code2, { code_verifier: verifier })).status).toBe(200);
  });

  it("403 when the app's flag is off", async () => {
    const code = await codeFor(A);
    await setFlag("collaborate_profile_api", false);
    expect((await goodExchange(code)).status).toBe(403);
  });
});

describe("GET /api/integrations/v1/profile", () => {
  it("returns only the token's user, masked by consent", async () => {
    const { token } = await mintAccessToken({ userId: A, email: "alice@example.com", name: "Alice", clientId: "collaborate" });
    const res = await getProfile(token);
    expect(res.status).toBe(200);
    const p = await res.json();
    expect(p).toMatchObject({ schema: "ProfessionalProjectionV1", audience: "collaborate", identity: { id: A, name: "Alice" } });
    expect(JSON.stringify(p)).not.toContain("Bob");
    expect(p.skills.items[0]).toMatchObject({ name: "PyTorch", verified: true });
    expect(p.skills.erisReadiness).toBeNull(); // ERIS not opted in
    expect(p.experience).toBeNull();
    expect(p.achievements).toBeNull();
    expect(p.privacy.masked).toEqual(expect.arrayContaining(["experience", "achievements", "activity", "skills.erisReadiness"]));
    expect(p.projects.map((x: { title: string }) => x.title).sort()).toEqual(["Alice Public Project", "Alice Secret Project"]);
  });

  it("shares ERIS and hides individual projects when the user says so", async () => {
    await saveConsent(A, "collaborate", {
      scopes: { ...ALL_OFF, skills: true, eris: true, projects: true, achievements: true },
      hiddenProjects: [projectKey("Alice Secret Project")],
    });
    const { token } = await mintAccessToken({ userId: A, email: null, name: null, clientId: "collaborate" });
    const p = await (await getProfile(token)).json();
    expect(p.skills.erisReadiness).toMatchObject({ score: 0.63, role: "ml_engineer" });
    expect(p.projects.map((x: { title: string }) => x.title)).toEqual(["Alice Public Project"]);
    expect(p.privacy.hiddenProjects).toBe(1);
    expect(p.achievements).toEqual([expect.objectContaining({ type: "certification", title: "Deep Learning" })]);
  });

  it("401 for tokens not signed by our key, HS256 tokens, and after the user disconnects", async () => {
    const { privateKey: other } = await generateKeyPair("ES256");
    const forged = await new SignJWT({ scope: "profile:read" }).setProtectedHeader({ alg: "ES256" }).setIssuer("https://www.aitathastu.com")
      .setAudience("collaborate").setSubject(B).setIssuedAt().setExpirationTime("10m").sign(other);
    expect((await getProfile(forged)).status).toBe(401);
    const hs = await new SignJWT({ scope: "profile:read" }).setProtectedHeader({ alg: "HS256" }).setIssuer("https://www.aitathastu.com")
      .setAudience("collaborate").setSubject(B).setIssuedAt().setExpirationTime("10m")
      .sign(new TextEncoder().encode(process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET));
    expect((await getProfile(hs)).status).toBe(401);

    const { token } = await mintAccessToken({ userId: A, email: null, name: null, clientId: "collaborate" });
    await revokeLink(A, "collaborate");
    expect((await getProfile(token)).status).toBe(401);
  });

  it("a user who never linked the app gets nothing, even with a valid token", async () => {
    const { token } = await mintAccessToken({ userId: B, email: null, name: null, clientId: "meet" });
    expect((await getProfile(token)).status).toBe(401);
  });
});

describe("webhook outbox", () => {
  beforeEach(async () => {
    await db.delete(schema.webhookOutbox);
  });

  it("coalesces pending events and delivers a signed, consent-filtered profile", async () => {
    await enqueueProfileUpdated(A, "facts_confirmed");
    await enqueueProfileUpdated(A, "profile_recomputed");
    expect(await db.select().from(schema.webhookOutbox)).toHaveLength(1);

    const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      calls.push({ url, headers: init.headers as Record<string, string>, body: init.body as string });
      return new Response(null, { status: 204 });
    });
    expect(await dispatchWebhooks()).toEqual({ delivered: 1, retrying: 0, failed: 0 });

    const [call] = calls;
    expect(call.url).toBe("https://collaborate.aitathastu.com/webhooks/ait");
    const [, t, v1] = call.headers["X-AIT-Signature"].match(/^t=(\d+),v1=([0-9a-f]{64})$/)!;
    expect(v1).toBe(createHmac("sha256", "whsec-collab-0123456789").update(`${t}.${call.body}`).digest("hex"));
    const body = JSON.parse(call.body);
    expect(body).toMatchObject({ type: "profile.updated", data: { userId: A, profile: { schema: "ProfessionalProjectionV1" } } });
    expect(body.data.profile.experience).toBeNull();
    const [row] = await db.select().from(schema.webhookOutbox);
    expect(row).toMatchObject({ status: "delivered", attempts: 1 });
  });

  it("retries with backoff on failure; apps without a webhook get nothing", async () => {
    await enqueueProfileUpdated(A, "x");
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    expect(await dispatchWebhooks()).toEqual({ delivered: 0, retrying: 1, failed: 0 });
    const [row] = await db.select().from(schema.webhookOutbox);
    expect(row).toMatchObject({ status: "pending", lastError: "HTTP 503" });
    expect(row.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000);

    await saveConsent(A, "meet", { scopes: ALL_OFF, link: true }); // Meet has no webhook URL configured
    expect(await enqueueProfileUpdated(A, "y", "meet")).toEqual([]);
  });

  it("integration.revoked carries no profile", async () => {
    await enqueueRevoked(A, "collaborate");
    let body = "";
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => ((body = init.body as string), new Response(null, { status: 200 })));
    await dispatchWebhooks();
    expect(JSON.parse(body)).toMatchObject({ type: "integration.revoked", data: { userId: A } });
    expect(JSON.parse(body).data.profile).toBeUndefined();
  });
});

describe("hardening", () => {
  it("Basic client auth splits on the first colon and form-decodes (RFC 6749 §2.3.1)", async () => {
    const code = await codeFor(A);
    const secret = process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET!;
    const basic = Buffer.from(`collaborate:${encodeURIComponent(secret)}`).toString("base64");
    const res = await tokenRoute.POST(new Request("https://www.aitathastu.com/api/integrations/sso/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, code_verifier: VERIFIER }).toString(),
    }));
    expect(res.status).toBe(200);
    const wrong = Buffer.from(`collaborate:${secret}:extra`).toString("base64");
    const bad = await tokenRoute.POST(new Request("https://x/api/integrations/sso/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", authorization: `Basic ${wrong}` },
      body: new URLSearchParams({ grant_type: "authorization_code", code: await codeFor(A), redirect_uri: REDIRECT }).toString(),
    }));
    expect(bad.status).toBe(401);
  });

  it("nothing is shared before the user turns it on (no pre-ticked consent)", async () => {
    const { effectiveScopes } = await import("@/lib/integrations/consent");
    expect(Object.values(effectiveScopes(null)).every((v) => v === false)).toBe(true);
  });
});

describe("signing-key rotation", () => {
  it("publishes previous public keys and still verifies their tokens; unknown kids fail", async () => {
    const { parseKeyConfig } = await import("@/lib/integrations/tokens");
    const { privateKey: oldKey, publicKey: oldPub } = await generateKeyPair("ES256", { extractable: true });
    const oldJwk = { ...(await exportJWK(oldPub)), kid: "old-key" };
    const env = { ...process.env, INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS: JSON.stringify([oldJwk]) };
    expect(parseKeyConfig(env).previous.map((k) => k.kid)).toEqual(["old-key"]);
    expect(() => parseKeyConfig({ ...env, INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS: JSON.stringify([{ ...oldJwk, d: "x" }]) })).toThrow(/private/);
    expect(() => parseKeyConfig({ ...env, INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS: JSON.stringify([{ ...oldJwk, kid: "test-key" }]) })).toThrow(/unique/);

    // A fresh module instance picks up the rotated config.
    vi.resetModules();
    process.env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS = JSON.stringify([oldJwk]);
    const fresh = await import("@/lib/integrations/tokens");
    expect((await fresh.publicJwks()).keys.map((k) => k.kid)).toEqual(["test-key", "old-key"]);
    const sign = (kid: string) =>
      new SignJWT({ scope: "profile:read" }).setProtectedHeader({ alg: "ES256", kid }).setIssuer("https://www.aitathastu.com")
        .setAudience("collaborate").setSubject(A).setIssuedAt().setExpirationTime("10m").sign(oldKey);
    expect(await fresh.verifyAccessToken(await sign("old-key"))).toEqual({ userId: A, clientId: "collaborate", sessionVersion: 0 });
    expect(await fresh.verifyAccessToken(await sign("not-published"))).toBeNull();
    delete process.env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS;
  });
});

describe("config check (no values revealed)", () => {
  it("flags missing, malformed and reused settings and never echoes values", async () => {
    const { checkIntegrationConfig } = await import("@/lib/integrations/config-check");
    const secret = "s".repeat(40);
    const checks = checkIntegrationConfig({
      INTEGRATION_JWT_PRIVATE_KEY: JSON.stringify({ kty: "EC", crv: "P-256", x: "x", y: "y", d: "d", kid: "e2e-test-key" }),
      INTEGRATION_COLLABORATE_CLIENT_SECRET: secret,
      INTEGRATION_COLLABORATE_WEBHOOK_URL: "https://collaborate.aitathastu.com/api/webhooks/tathastu",
      INTEGRATION_COLLABORATE_WEBHOOK_SECRET: secret, // reused: must be flagged
      INTEGRATION_COLLABORATE_REDIRECT_URIS: '["https://collaborate.aitathastu.com/api/auth/tathastu/callback"]',
      INTEGRATION_MEET_WEBHOOK_URL: "http://connect.aitathastu.com/hook",
      INTERNAL_API_SECRET: "short",
    });
    const by = (n: string) => checks.find((c) => c.name === n)!;
    expect(by("INTEGRATION_JWT_PRIVATE_KEY").problems.join()).toMatch(/test key/);
    expect(by("INTEGRATION_COLLABORATE_WEBHOOK_SECRET").problems.join()).toMatch(/same value as INTEGRATION_COLLABORATE_CLIENT_SECRET/);
    expect(by("INTEGRATION_COLLABORATE_REDIRECT_URIS").problems.join()).toMatch(/JSON array/);
    expect(by("INTEGRATION_MEET_WEBHOOK_URL").problems.join()).toMatch(/https/);
    expect(by("INTEGRATION_MEET_WEBHOOK_SECRET")).toMatchObject({ required: true, present: false, ok: false });
    expect(by("INTERNAL_API_SECRET").ok).toBe(false);
    expect(JSON.stringify(checks)).not.toContain(secret);
  });

  it("accepts the exact Collaborate production URLs", async () => {
    const { checkIntegrationConfig } = await import("@/lib/integrations/config-check");
    const checks = checkIntegrationConfig({
      INTEGRATION_COLLABORATE_REDIRECT_URIS: "https://collaborate.aitathastu.com/api/auth/tathastu/callback",
      INTEGRATION_COLLABORATE_WEBHOOK_URL: "https://collaborate.aitathastu.com/api/webhooks/tathastu",
    });
    expect(checks.find((c) => c.name === "INTEGRATION_COLLABORATE_REDIRECT_URIS")).toMatchObject({ ok: true, problems: [] });
    expect(checks.find((c) => c.name === "INTEGRATION_COLLABORATE_WEBHOOK_URL")).toMatchObject({ ok: true, problems: [] });
  });
});
