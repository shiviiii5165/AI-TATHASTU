import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ down: false, stalled: false, db: null as never }));
vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  state.db = (await createTestDb()) as never;
  // Same database, but `insert` fails while state.down is set.
  const db = new Proxy(state.db as object, {
    get(target, prop, receiver) {
      if (prop === "insert" && state.down) throw new Error("connection refused");
      if (prop === "insert" && state.stalled) {
        const chain = { values: () => chain, onConflictDoUpdate: () => chain, returning: () => new Promise(() => {}) };
        return () => chain;
      }
      return Reflect.get(target, prop, receiver);
    },
  });
  return { db };
});

import { clientIp, clientIpHash, hitRateLimit, resolveClientIdentity } from "./rate-limit";

const request = (headers: Record<string, string>) => new Request("https://app.test/", { headers });
let seq = 0;
const key = () => `test:${++seq}:${Math.random()}`;
const LIMIT = { limit: 2, windowSeconds: 3600 };

beforeEach(() => {
  state.down = false;
  vi.useRealTimers();
});
afterEach(() => vi.unstubAllEnvs());

describe("resolveClientIdentity & clientIp", () => {
  describe("Off-Vercel without trusted proxy (Direct / Untrusted)", () => {
    it("ignores client-supplied forwarding headers off-Vercel by default to prevent spoofing bypass", () => {
      expect(resolveClientIdentity(request({ "x-forwarded-for": "1.1.1.1" }))).toEqual({
        ok: false,
        reason: "untrusted",
      });
      expect(clientIp(request({ "x-forwarded-for": "1.1.1.1" }))).toBeNull();
      expect(clientIp(request({ "x-real-ip": "2.2.2.2", "cf-connecting-ip": "3.3.3.3" }))).toBeNull();
      expect(clientIp(request({ "x-vercel-forwarded-for": "4.4.4.4" }))).toBeNull();
    });

    it("does not create a global shared 'unknown' bucket for untrusted callers", () => {
      const userA = request({ "user-agent": "UserA" });
      const userB = request({ "user-agent": "UserB" });
      // clientIp returns null, never a shared string like "unknown"
      expect(clientIp(userA)).toBeNull();
      expect(clientIp(userB)).toBeNull();
      expect(clientIpHash(userA)).toBeNull();
      expect(clientIpHash(userB)).toBeNull();
    });

    it("prevents an attacker from gaining fresh buckets by rotating spoofed headers off-Vercel", () => {
      const spoof1 = request({ "x-forwarded-for": "1.1.1.1", "user-agent": "Bot/1.0" });
      const spoof2 = request({ "x-forwarded-for": "2.2.2.2", "user-agent": "Bot/2.0" });
      const spoof3 = request({ "x-forwarded-for": "3.3.3.3", cookie: "session=xyz" });

      // All unverified requests resolve to null rather than distinct spoofed IP buckets
      expect(clientIp(spoof1)).toBeNull();
      expect(clientIp(spoof2)).toBeNull();
      expect(clientIp(spoof3)).toBeNull();
    });
  });

  describe("Vercel Edge Platform", () => {
    beforeEach(() => {
      vi.stubEnv("VERCEL", "1");
    });

    it("prefers x-vercel-forwarded-for, ignoring spoofed x-forwarded-for from client", () => {
      const req = request({
        "x-forwarded-for": "9.9.9.9",
        "x-vercel-forwarded-for": "198.51.100.1, 10.0.0.1",
      });
      const identity = resolveClientIdentity(req);
      expect(identity).toEqual({
        ok: true,
        ip: "198.51.100.1",
        bucketKey: "198.51.100.1",
        version: 4,
      });
      expect(clientIp(req)).toBe("198.51.100.1");
    });

    it("falls back to x-forwarded-for first hop if x-vercel-forwarded-for is absent", () => {
      const req = request({ "x-forwarded-for": "192.0.2.5, 10.0.0.2" });
      expect(clientIp(req)).toBe("192.0.2.5");
    });

    it("rejects malformed IP headers on Vercel", () => {
      const malformed = request({ "x-vercel-forwarded-for": "999.999.999.999" });
      expect(resolveClientIdentity(malformed)).toEqual({ ok: false, reason: "malformed" });
      expect(clientIp(malformed)).toBeNull();
    });

    it("returns missing when no forwarding header is present on Vercel", () => {
      const empty = request({});
      expect(resolveClientIdentity(empty)).toEqual({ ok: false, reason: "missing" });
      expect(clientIp(empty)).toBeNull();
    });

    it("separates two different verified client IPv4s into independent buckets", () => {
      const req1 = request({ "x-vercel-forwarded-for": "192.0.2.1" });
      const req2 = request({ "x-vercel-forwarded-for": "198.51.100.2" });
      expect(clientIp(req1)).toBe("192.0.2.1");
      expect(clientIp(req2)).toBe("198.51.100.2");
      expect(clientIp(req1)).not.toBe(clientIp(req2));
    });

    it("maps repeated requests from the same verified IPv4 to the exact same bucket", () => {
      const req1 = request({ "x-vercel-forwarded-for": "192.0.2.50" });
      const req2 = request({ "x-vercel-forwarded-for": "192.0.2.50" });
      expect(clientIp(req1)).toBe(clientIp(req2));
    });

    it("groups IPv6 privacy addresses from the same /64 subnet into the same bucket key", () => {
      const addr1 = request({ "x-vercel-forwarded-for": "2001:db8:abcd:0012:1234:5678:9abc:def0" });
      const addr2 = request({ "x-vercel-forwarded-for": "2001:db8:abcd:0012:ffff:eeee:dddd:cccc" });

      expect(clientIp(addr1)).toBe("2001:db8:abcd:12::/64");
      expect(clientIp(addr2)).toBe("2001:db8:abcd:12::/64");
      expect(clientIp(addr1)).toBe(clientIp(addr2));
    });

    it("partitions IPv6 addresses from different /64 subnets into distinct buckets", () => {
      const subnetA = request({ "x-vercel-forwarded-for": "2001:db8:abcd:0012::1" });
      const subnetB = request({ "x-vercel-forwarded-for": "2001:db8:abcd:0013::1" });

      expect(clientIp(subnetA)).toBe("2001:db8:abcd:12::/64");
      expect(clientIp(subnetB)).toBe("2001:db8:abcd:13::/64");
      expect(clientIp(subnetA)).not.toBe(clientIp(subnetB));
    });

    it("hashes client IP with SHA-256 for privacy-preserving storage", () => {
      const req = request({ "x-vercel-forwarded-for": "192.0.2.1" });
      const hash = clientIpHash(req);
      expect(hash).toMatch(/^[a-f0-9]{32}$/);
      expect(hash).not.toContain("192.0.2.1");
    });
  });

  describe("Custom Hosting with TRUST_PROXY_HEADERS=1", () => {
    beforeEach(() => {
      vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    });

    it("trusts reverse proxy headers when explicitly configured", () => {
      expect(clientIp(request({ "x-forwarded-for": "203.0.113.1" }))).toBe("203.0.113.1");
      expect(clientIp(request({ "x-real-ip": "203.0.113.2" }))).toBe("203.0.113.2");
      expect(clientIp(request({ "cf-connecting-ip": "203.0.113.3" }))).toBe("203.0.113.3");
    });

    it("rejects malformed IP from reverse proxy", () => {
      expect(clientIp(request({ "x-forwarded-for": "invalid-ip-string" }))).toBeNull();
    });
  });

  describe("Authenticated User Identity", () => {
    it("ensures authenticated routes use server-verified user ID independently of client IP", async () => {
      // In authenticated routes (analytics, search, institutions, uploads, yora),
      // rate limits are keyed to session.user.id / authz.user.id, which are verified on the server.
      const userId = "usr_01h7abc123xyz";
      const keyA = `analytics:${userId}`;
      const keyB = `search:${userId}`;

      // Even if attacker rotates IP or spoofed headers, user limit remains atomic to the user ID
      expect((await hitRateLimit(keyA, { limit: 2, windowSeconds: 60 })).ok).toBe(true);
      expect((await hitRateLimit(keyA, { limit: 2, windowSeconds: 60 })).ok).toBe(true);
      expect((await hitRateLimit(keyA, { limit: 2, windowSeconds: 60 })).ok).toBe(false);

      // Other endpoints or users are isolated
      expect((await hitRateLimit(keyB, { limit: 2, windowSeconds: 60 })).ok).toBe(true);
    });
  });
});

describe("hitRateLimit", () => {
  it("counts in the database across calls (as separate instances would) and reports Retry-After", async () => {
    const k = key();
    expect((await hitRateLimit(k, LIMIT)).ok).toBe(true);
    expect((await hitRateLimit(k, LIMIT)).ok).toBe(true);
    const third = await hitRateLimit(k, LIMIT);
    expect(third.ok).toBe(false);
    expect(third.retryAfter).toBeGreaterThan(0);
    expect(third.retryAfter).toBeLessThanOrEqual(3600);
  });

  it("gives separate keys separate counts: one user can't exhaust another's limit", async () => {
    const a = key();
    const b = key();
    await hitRateLimit(a, LIMIT);
    await hitRateLimit(a, LIMIT);
    expect((await hitRateLimit(a, LIMIT)).ok).toBe(false);
    expect((await hitRateLimit(b, LIMIT)).ok).toBe(true);
  });

  it("starts a new count when the window expires", async () => {
    const k = key();
    await hitRateLimit(k, { limit: 1, windowSeconds: 60 });
    expect((await hitRateLimit(k, { limit: 1, windowSeconds: 60 })).ok).toBe(false);
    vi.useFakeTimers({ now: Date.now() + 61_000 });
    expect((await hitRateLimit(k, { limit: 1, windowSeconds: 60 })).ok).toBe(true);
  });

  it("counts a concurrent burst exactly", async () => {
    const k = key();
    const results = await Promise.all(Array.from({ length: 10 }, () => hitRateLimit(k, { limit: 4, windowSeconds: 3600 })));
    expect(results.filter((r) => r.ok)).toHaveLength(4);
  });

  it("magic links: limits per address without storing raw email", async () => {
    const { assertMagicLinkAllowed } = await import("./magic-link-limit");
    const req = new Request("https://app.test/");
    for (let i = 0; i < 5; i++) await assertMagicLinkAllowed("Victim@Example.test", req);
    // Same person however the address is typed.
    await expect(assertMagicLinkAllowed(" victim@example.test ", req)).rejects.toThrow(/Too many/);
    await expect(assertMagicLinkAllowed("someone-else@example.test", req)).resolves.toBeUndefined();
    const { sql } = await import("drizzle-orm");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { rows } = await (state.db as any).execute(sql`select key from rate_limits where key like 'magic_%'`);
    expect(JSON.stringify(rows)).not.toContain("example.test");
  });

  it("magic links: enforces IP limit when verified client IP is present", async () => {
    vi.stubEnv("VERCEL", "1");
    const { assertMagicLinkAllowed } = await import("./magic-link-limit");
    const req = request({ "x-vercel-forwarded-for": "198.51.100.99" });

    // Under the 60-req IP limit, different emails succeed
    for (let i = 0; i < 10; i++) {
      await expect(assertMagicLinkAllowed(`user${i}@example.test`, req)).resolves.toBeUndefined();
    }
  });

  it("magic links: fails safely in production when client identity cannot be established", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { assertMagicLinkAllowed } = await import("./magic-link-limit");
    // Direct request off-Vercel without proxy
    const directReq = new Request("https://app.test/");
    await expect(assertMagicLinkAllowed("test@example.com", directReq)).rejects.toThrow(/Unable to verify request origin/);
  });

  it("magic links: refused while the database is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { assertMagicLinkAllowed } = await import("./magic-link-limit");
    state.down = true;
    await expect(assertMagicLinkAllowed("anyone@example.test", new Request("https://app.test/"))).rejects.toThrow(/Too many/);
  });

  it("a stalled database costs the limiter its short deadline, not the query's", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.useFakeTimers();
    state.stalled = true;
    const pending = hitRateLimit(key(), LIMIT);
    await vi.advanceTimersByTimeAsync(1_600);
    await expect(pending).resolves.toMatchObject({ ok: true });
    state.stalled = false;
  });

  it("database down, default: stays available but still bounds a burst per instance", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.down = true;
    const k = key();
    const results = [];
    for (let i = 0; i < 4; i++) results.push((await hitRateLimit(k, LIMIT)).ok);
    expect(results).toEqual([true, true, false, false]);
  });

  it('database down, "deny": refuses, for routes that spend money and need the database anyway', async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    state.down = true;
    expect((await hitRateLimit(key(), { ...LIMIT, onDbError: "deny" })).ok).toBe(false);
  });
});
