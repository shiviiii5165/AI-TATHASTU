import { createHash } from "node:crypto";

import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";

const { privateKey } = await generateKeyPair("ES256", { extractable: true });
process.env.INTEGRATION_JWT_PRIVATE_KEY = JSON.stringify({ ...(await exportJWK(privateKey)), kid: "k" });
process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET = "collab-secret-0123456789abcdef0123";
process.env.INTEGRATION_COLLABORATE_REDIRECT_URIS = "https://collaborate.aitathastu.com/auth/callback";

vi.mock("@/db", async () => {
  const { createPoolDb } = await import("@/test/real-postgres");
  return { db: createPoolDb() };
});
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const { resetAndMigrate } = await import("@/test/real-postgres");
const { db } = await import("@/db");
const { featureFlags, users } = await import("@/db/schema");
const tokenRoute = await import("@/app/api/integrations/sso/token/route");
const { issueCode, parseAuthorizeRequest } = await import("@/lib/integrations/authorize");
const { saveConsent } = await import("@/lib/integrations/consent");
const { isSignInLocked, liveSessionVersion } = await import("@/lib/auth/account-lock");

const USER = "00000000-0000-4000-8000-0000000000a1";
const REDIRECT = "https://collaborate.aitathastu.com/auth/callback";
const VERIFIER = "a".repeat(64);

beforeAll(async () => {
  await resetAndMigrate();
  await db.update(featureFlags).set({ enabled: true });
  await db.insert(users).values({ id: USER, email: "a@example.com" });
  await saveConsent(USER, "collaborate", { scopes: {} as never, link: true });
});

describe("on independent connections", () => {
  it("a code replayed concurrently yields exactly one token", async () => {
    const parsed = await parseAuthorizeRequest({
      client_id: "collaborate", redirect_uri: REDIRECT, state: "s", code_challenge_method: "S256",
      code_challenge: createHash("sha256").update(VERIFIER).digest("base64url"),
    });
    if (!parsed.ok) throw new Error(parsed.message);
    const code = new URL(await issueCode(USER, parsed.req)).searchParams.get("code")!;
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        tokenRoute.POST(new Request("https://app.test/t", {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT, client_id: "collaborate", client_secret: process.env.INTEGRATION_COLLABORATE_CLIENT_SECRET!, code_verifier: VERIFIER }).toString(),
        })),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 400)).toHaveLength(14);
  });

  it("the account lock reads correctly on real Postgres, including by address", async () => {
    expect(await liveSessionVersion(USER)).toBe(0);
    await db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, USER));
    expect(await liveSessionVersion(USER)).toBeNull();
    expect(await isSignInLocked({ id: "00000000-0000-4000-8000-0000000000ff", email: "A@EXAMPLE.COM" })).toBe(true);
  });
});
