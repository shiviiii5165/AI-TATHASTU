import { createHash } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const current = await generateKeyPair("ES256", { extractable: true });
const previous = await generateKeyPair("ES256", { extractable: true });
const outsider = await generateKeyPair("ES256", { extractable: true });
process.env.INTEGRATION_JWT_PRIVATE_KEY = JSON.stringify({ ...(await exportJWK(current.privateKey)), kid: "current" });
process.env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS = JSON.stringify([{ ...(await exportJWK(previous.publicKey)), kid: "previous" }]);
process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET = "collab-secret-0123456789abcdef0123";
process.env.INTEGRATION_COLLABORATE_REDIRECT_URIS = "https://collaborate.aitathastu.com/auth/callback";
process.env.INTEGRATION_MEET_CLIENT_SECRET = "meet-secret-0123456789abcdef012345";
process.env.EMBED_JWT_SECRET = "embed-secret-embed-secret-embed-secret-12";
process.env.AUTH_SECRET = "auth-secret-auth-secret-auth-secret-1234";
process.env.EMBED_ALLOWED_ORIGINS = "https://pilot.example";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const { db } = await import("@/db");
const { featureFlags, integrationAuthCodes, onboardingState, rateLimits, users } = await import("@/db/schema");
const tokenRoute = await import("@/app/api/integrations/sso/token/route");
const profileRoute = await import("@/app/api/integrations/v1/profile/route");
const meRoute = await import("@/app/api/profile/v1/me/route");
const jwks = await import("@/app/api/integrations/jwks/route");
const { issueCode, parseAuthorizeRequest } = await import("@/lib/integrations/authorize");
const { saveConsent, revokeLink } = await import("@/lib/integrations/consent");
const { ISSUER, mintAccessToken, verifyAccessToken } = await import("@/lib/integrations/tokens");
const { signWebhook } = await import("@/lib/integrations/webhooks");
const { mintEmbedToken, verifyEmbedToken } = await import("@/lib/embed-token");

const REDIRECT = "https://collaborate.aitathastu.com/auth/callback";
const SECRET = process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET!;
const VERIFIER = "a".repeat(64);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const OFF = { education: false, skills: false, eris: false, projects: false, experience: false, achievements: false, activity: false };
let next = 1;
let user: string;

const authorize = (extra: Record<string, string> = {}) =>
  parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, state: "s", code_challenge: CHALLENGE, code_challenge_method: "S256", ...extra });
const codeFor = async (extra: Record<string, string> = {}) => {
  const parsed = await authorize(extra);
  if (!parsed.ok) throw new Error(parsed.message);
  return new URL(await issueCode(user, parsed.req)).searchParams.get("code")!;
};
const exchange = (code: string, extra: Record<string, string> = {}) =>
  tokenRoute.POST(new Request("https://app.test/api/integrations/sso/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: "collaborate", client_secret: SECRET, code_verifier: VERIFIER, ...extra }).toString(),
  }));
const profile = (token: string) => profileRoute.GET(new Request("https://app.test/api/integrations/v1/profile", { headers: { authorization: `Bearer ${token}` } }));
const revokeSessions = () => db.update(users).set({ sessionVersion: sql`${users.sessionVersion} + 1` }).where(eq(users.id, user));

const forge = (over: { key?: CryptoKey; kid?: string; iss?: string; aud?: string; exp?: string | number | null; alg?: string } = {}) => {
  let jwt = new SignJWT({ scope: "profile:read", sv: 0 })
    .setProtectedHeader({ alg: over.alg ?? "ES256", kid: over.kid ?? "current" })
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? "collaborate")
    .setSubject(user)
    .setIssuedAt();
  if (over.exp !== null) jwt = jwt.setExpirationTime(over.exp ?? "10m");
  return jwt.sign(over.key ?? current.privateKey);
};

beforeAll(async () => {
  await db.update(featureFlags).set({ enabled: true });
});

beforeEach(async () => {
  await db.delete(rateLimits);
  user = `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  await db.insert(users).values({ id: user, name: "A", email: `${user}@example.com` });
  await db.insert(onboardingState).values({ userId: user, currentStep: "done" });
  await saveConsent(user, "collaborate", { scopes: { ...OFF, skills: true }, hiddenProjects: [], link: true });
});

describe("access token validation", () => {
  it("accepts a good token", async () => {
    expect(await verifyAccessToken(await forge())).toMatchObject({ userId: user, clientId: "collaborate" });
  });

  it.each([
    ["expired", { exp: Math.floor(Date.now() / 1000) - 60 }],
    ["no expiry at all", { exp: null }],
    ["wrong issuer", { iss: "https://evil.example" }],
    ["wrong audience", { aud: "someone-else" }],
    ["unknown key id", { kid: "nope" }],
  ])("refuses %s", async (_name, over) => {
    expect(await verifyAccessToken(await forge(over))).toBeNull();
  });

  it("refuses an invalid signature", async () => {
    expect(await verifyAccessToken(await forge({ key: outsider.privateKey }))).toBeNull();
    const good = await forge();
    expect(await verifyAccessToken(`${good.slice(0, -4)}AAAA`)).toBeNull();
  });

  it("a token for Meet isn't a token for Collaborate", async () => {
    const res = await profile(await forge({ aud: "meet" }));
    expect(res.status).toBe(401); // the user only linked Collaborate
  });
});

describe("key rotation", () => {
  it("still verifies a token from the published previous key, and publishes no private material", async () => {
    expect(await verifyAccessToken(await forge({ key: previous.privateKey, kid: "previous" }))).toMatchObject({ userId: user });
    const body = await (await jwks.GET()).json();
    expect(body.keys.map((k: { kid: string }) => k.kid).sort()).toEqual(["current", "previous"]);
    for (const key of body.keys) expect(key.d).toBeUndefined();
  });

  it("the old key can't claim the new key's id", async () => {
    expect(await verifyAccessToken(await forge({ key: previous.privateKey, kid: "current" }))).toBeNull();
  });
});

describe("PKCE", () => {
  it("is required at authorize, and the error goes only to the registered address", async () => {
    const parsed = await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, state: "s" });
    expect(parsed).toMatchObject({ ok: false, redirect: expect.stringMatching(/^https:\/\/collaborate\.aitathastu\.com\/auth\/callback\?error=invalid_request/) });
  });

  it("refuses a missing, wrong or malformed verifier, and burns the code", async () => {
    const code = await codeFor();
    expect((await exchange(code, { code_verifier: "" })).status).toBe(400);
    expect((await exchange(code)).status).toBe(400); // spent by the failed attempt
    expect((await exchange(await codeFor(), { code_verifier: "b".repeat(64) })).status).toBe(400);
    expect((await exchange(await codeFor(), { code_verifier: "short" })).status).toBe(400);
  });

  it("refuses a stored code without a challenge once PKCE is required", async () => {
    await db.insert(integrationAuthCodes).values({
      codeHash: createHash("sha256").update("legacy-code").digest("base64url"),
      clientId: "collaborate", userId: user, redirectUri: REDIRECT, expiresAt: new Date(Date.now() + 60_000),
    });
    expect((await exchange("legacy-code")).status).toBe(400);
  });

  it("the temporary per-app setting allows a migration, for that app only", async () => {
    vi.stubEnv("INTEGRATION_MEET_PKCE_OPTIONAL", "1");
    expect(await parseAuthorizeRequest({ client_id: "meet", redirect_uri: "https://connect.aitathastu.com/api/auth/tathastu/callback", state: "s" })).toMatchObject({ ok: true });
    expect(await parseAuthorizeRequest({ client_id: "collaborate", redirect_uri: REDIRECT, state: "s" })).toMatchObject({ ok: false });
    vi.unstubAllEnvs();
  });

  it("even with PKCE optional, a code that has a challenge must meet it", async () => {
    vi.stubEnv("INTEGRATION_COLLABORATE_PKCE_OPTIONAL", "1");
    expect((await exchange(await codeFor(), { code_verifier: "b".repeat(64) })).status).toBe(400);
    vi.unstubAllEnvs();
  });
});

describe("authorization codes", () => {
  it("work once, even when replayed concurrently", async () => {
    const code = await codeFor();
    const results = await Promise.all([exchange(code), exchange(code), exchange(code)]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });

  it("refuse another client, a different redirect, and an expired code", async () => {
    expect((await exchange(await codeFor(), { client_id: "meet", client_secret: process.env.INTEGRATION_MEET_CLIENT_SECRET! })).status).toBe(400);
    expect((await exchange(await codeFor(), { redirect_uri: "https://collaborate.aitathastu.com/other" })).status).toBe(400);
    const code = await codeFor();
    await db.update(integrationAuthCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(integrationAuthCodes.userId, user));
    expect((await exchange(code)).status).toBe(400);
  });

  it("never redirect to an unregistered address", async () => {
    for (const uri of ["https://evil.example/cb", `${REDIRECT}/../x`, `${REDIRECT}?next=https://evil.example`, `https://user:pw@collaborate.aitathastu.com/auth/callback`]) {
      const parsed = await authorize({ redirect_uri: uri });
      expect(parsed).toMatchObject({ ok: false });
      expect((parsed as { redirect?: string }).redirect).toBeUndefined();
    }
  });

  it("die with a session revocation that happens before the exchange", async () => {
    const code = await codeFor();
    await revokeSessions();
    expect((await exchange(code)).status).toBe(400);
  });

  it("die with a revoked app link and a deleted account", async () => {
    const revoked = await codeFor();
    await revokeLink(user, "collaborate");
    expect((await exchange(revoked)).status).toBe(400);
    await saveConsent(user, "collaborate", { scopes: OFF, link: true });
    const gone = await codeFor();
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user));
    expect((await exchange(gone)).status).toBe(400);
  });
});

describe("token endpoint abuse", () => {
  it("throttles guessing before checking the secret, and spoofed headers don't help", async () => {
    let last = 0;
    for (let i = 0; i < 121; i++) {
      last = (await tokenRoute.POST(new Request("https://app.test/t", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": `203.0.113.${i % 250}` },
        body: new URLSearchParams({ client_id: "collaborate", client_secret: `guess-${i}` }).toString(),
      }))).status;
    }
    expect(last).toBe(429);
  });

  it("refuses when the limiter's database is down", async () => {
    const insert = vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("down");
    });
    expect((await exchange("x")).status).toBe(429);
    insert.mockRestore();
  });
});

describe("revocation reaches secondary tokens", () => {
  const me = (token: string) => meRoute.GET(new Request("https://app.test/api/profile/v1/me", { headers: { authorization: `Bearer ${token}`, origin: "https://pilot.example" } }));

  it("an integration token stops working on our API as soon as sessions are revoked", async () => {
    const res = await exchange(await codeFor());
    const { access_token: token } = await res.json();
    expect((await profile(token)).status).toBe(200);
    await revokeSessions();
    expect((await profile(token)).status).toBe(401);
  });

  it("a fresh token after re-authorizing works, with the new version", async () => {
    await revokeSessions();
    const { access_token: token } = await (await exchange(await codeFor())).json();
    expect((await profile(token)).status).toBe(200);
  });

  it("revoked consent and deleted accounts stop it too", async () => {
    const { token } = await mintAccessToken({ userId: user, email: null, name: null, clientId: "collaborate" });
    await revokeLink(user, "collaborate");
    expect((await profile(token)).status).toBe(401);
    await saveConsent(user, "collaborate", { scopes: OFF, link: true });
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user));
    expect((await profile(token)).status).toBe(401);
  });

  it("an embed token stops working when sessions are revoked, or the account is deleted", async () => {
    const { token } = await mintEmbedToken(user, "https://pilot.example");
    expect((await me(token)).status).toBe(200);
    await revokeSessions();
    expect((await me(token)).status).toBe(401);

    const { token: second } = await mintEmbedToken(user, "https://pilot.example", 1);
    expect((await me(second)).status).toBe(200);
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, user));
    expect((await me(second)).status).toBe(401);
  });

  it("an embed token needs an expiry and can't be used from another origin", async () => {
    const noExpiry = await new SignJWT({ scope: "profile:read:embed", origin: "https://pilot.example", sv: 0 })
      .setProtectedHeader({ alg: "HS256" }).setSubject(user).setIssuer("aitathastu").setAudience("ait-embed")
      .sign(new TextEncoder().encode(process.env.EMBED_JWT_SECRET));
    expect(await verifyEmbedToken(noExpiry, "https://pilot.example")).toBeNull();
    const { token } = await mintEmbedToken(user, "https://pilot.example");
    expect(await verifyEmbedToken(token, "https://evil.example")).toBeNull();
  });
});

describe("webhook signatures", () => {
  it("cover the timestamp, so a replayed or edited delivery fails the receiver's check", () => {
    const body = '{"id":"1"}';
    const first = signWebhook("secret", body, 1_800_000_000);
    expect(first.header).toMatch(/^t=1800000000,v1=[0-9a-f]{64}$/);
    expect(signWebhook("secret", body, 1_800_000_001).header.split("v1=")[1]).not.toBe(first.header.split("v1=")[1]);
    expect(signWebhook("secret", `${body} `, 1_800_000_000).header).not.toBe(first.header);
    expect(signWebhook("other", body, 1_800_000_000).header).not.toBe(first.header);
  });
});
