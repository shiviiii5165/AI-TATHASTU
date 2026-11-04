/**
 * GET /api/integrations/jwks: publishes exactly the public half of the active
 * ES256 signing key (plus retired public keys during rotation), its kid
 * matches minted tokens, and misconfiguration fails safely without leaking
 * key material.
 */
import { createLocalJWKSet, decodeProtectedHeader, exportJWK, generateKeyPair, jwtVerify } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

const current = await generateKeyPair("ES256", { extractable: true });
const previous = await generateKeyPair("ES256", { extractable: true });
const currentJwk = { ...(await exportJWK(current.privateKey)), kid: "current-kid" };
const previousPub = { ...(await exportJWK(previous.publicKey)), kid: "previous-kid" };

const saved = { key: process.env.INTEGRATION_JWT_PRIVATE_KEY, prev: process.env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS };

async function load(env: { key?: string; prev?: string }) {
  vi.resetModules();
  if (env.key === undefined) delete process.env.INTEGRATION_JWT_PRIVATE_KEY;
  else process.env.INTEGRATION_JWT_PRIVATE_KEY = env.key;
  if (env.prev === undefined) delete process.env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS;
  else process.env.INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS = env.prev;
  const route = await import("@/app/api/integrations/jwks/route");
  const tokens = await import("@/lib/integrations/tokens");
  return { route, tokens };
}

let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
  for (const [k, v] of [["INTEGRATION_JWT_PRIVATE_KEY", saved.key], ["INTEGRATION_JWT_PREVIOUS_PUBLIC_KEYS", saved.prev]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("JWKS endpoint", () => {
  it("publishes the public key of the active signer; minted tokens carry its kid and verify against it", async () => {
    const { route, tokens } = await load({ key: JSON.stringify(currentJwk) });
    const res = await route.GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    const body = await res.json();
    expect(body.keys).toEqual([{ kty: "EC", crv: "P-256", x: currentJwk.x, y: currentJwk.y, kid: "current-kid", alg: "ES256", use: "sig" }]);
    expect(JSON.stringify(body)).not.toContain(currentJwk.d);
    expect(body.keys.every((k: Record<string, unknown>) => !("d" in k))).toBe(true);

    const { token } = await tokens.mintAccessToken({ userId: "u1", email: null, name: null, clientId: "collaborate" });
    expect(decodeProtectedHeader(token)).toMatchObject({ alg: "ES256", kid: "current-kid" });
    // Exactly what Collaborate does: verify against the published key set.
    const { payload } = await jwtVerify(token, createLocalJWKSet(body), {
      issuer: tokens.ISSUER, audience: "collaborate", algorithms: ["ES256"],
    });
    expect(payload).toMatchObject({ sub: "u1", scope: "profile:read" });
  });

  it("keeps previous public keys published during rotation", async () => {
    const { route } = await load({ key: JSON.stringify(currentJwk), prev: JSON.stringify([previousPub]) });
    const body = await (await route.GET()).json();
    expect(body.keys.map((k: { kid: string }) => k.kid)).toEqual(["current-kid", "previous-kid"]);
    expect(body.keys[1]).toMatchObject({ x: previousPub.x, y: previousPub.y });
  });

  it("is not prerendered: it opts into dynamic rendering via connection()", async () => {
    const src = (await import("node:fs")).readFileSync("src/app/api/integrations/jwks/route.ts", "utf8");
    expect(src).toMatch(/await connection\(\)/);
  });

  const failures: [string, { key?: string; prev?: string }, RegExp][] = [
    ["missing", {}, /is not set/],
    ["blank", { key: "   " }, /is not set/],
    ["not JSON", { key: "not-json" }, /not valid JSON/],
    ["wrapped in quotes", { key: `'${JSON.stringify(currentJwk)}'` }, /wrapped in quotes/],
    ["a public key (no d)", { key: JSON.stringify({ ...currentJwk, d: undefined }) }, /EC P-256 private JWK/],
    ["x/y from another key", { key: JSON.stringify({ ...currentJwk, x: previousPub.x, y: previousPub.y }) }, /do not match|could not be imported/],
    ["garbage coordinates", { key: JSON.stringify({ ...currentJwk, x: "AAAA", y: "AAAA" }) }, /could not be imported/],
  ];
  for (const [name, env, logged] of failures) {
    it(`fails safely (503, no-store, no key material) when the key is ${name}`, async () => {
      const { route } = await load(env);
      const res = await route.GET();
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toBe("no-store");
      const text = await res.text();
      expect(JSON.parse(text)).toEqual({ keys: [], error: "signing_key_unavailable" });
      expect(text).not.toContain(currentJwk.d);
      const logs = JSON.stringify(errorSpy.mock.calls);
      expect(logs).toMatch(logged);
      expect(logs).not.toContain(currentJwk.d);
    });
  }

  it("rejects private material in the previous-keys list without echoing it", async () => {
    const { route } = await load({ key: JSON.stringify(currentJwk), prev: JSON.stringify([{ ...previousPub, d: currentJwk.d }]) });
    const res = await route.GET();
    expect(res.status).toBe(503);
    expect(await res.text()).not.toContain(currentJwk.d);
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain(currentJwk.d);
  });
});
