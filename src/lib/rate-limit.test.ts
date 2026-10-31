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

import { clientIp, hitRateLimit } from "./rate-limit";

const request = (headers: Record<string, string>) => new Request("https://app.test/", { headers });
let seq = 0;
const key = () => `test:${++seq}:${Math.random()}`;
const LIMIT = { limit: 2, windowSeconds: 3600 };

beforeEach(() => {
  state.down = false;
  vi.useRealTimers();
});
afterEach(() => vi.unstubAllEnvs());

describe("clientIp", () => {
  it("ignores forwarding headers when no trusted edge set them, so spoofing can't buy a fresh bucket", () => {
    expect(clientIp(request({ "x-forwarded-for": "1.1.1.1" }))).toBe("unknown");
    expect(clientIp(request({ "x-forwarded-for": "2.2.2.2", "x-real-ip": "3.3.3.3", "x-vercel-forwarded-for": "4.4.4.4" }))).toBe("unknown");
  });

  it("uses the client hop behind Vercel, preferring the header other proxies don't rewrite", () => {
    vi.stubEnv("VERCEL", "1");
    expect(clientIp(request({ "x-forwarded-for": "9.9.9.9", "x-vercel-forwarded-for": "4.4.4.4, 5.5.5.5" }))).toBe("4.4.4.4");
    expect(clientIp(request({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(clientIp(request({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
    expect(clientIp(request({}))).toBe("unknown");
  });

  it("trusts them elsewhere only when explicitly configured", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "1");
    expect(clientIp(request({ "x-forwarded-for": "1.1.1.1" }))).toBe("1.1.1.1");
  });

  it("partitions untrusted clients using entropy so independent users cannot share a rate-limit bucket", () => {
    const userA = request({ "user-agent": "Mozilla/5.0 UserA", "accept-language": "en-US" });
    const userB = request({ "user-agent": "Mozilla/5.0 UserB", "accept-language": "en-GB" });
    const ipA = clientIp(userA);
    const ipB = clientIp(userB);

    expect(ipA).toMatch(/^untrusted:[a-f0-9]{16}$/);
    expect(ipB).toMatch(/^untrusted:[a-f0-9]{16}$/);
    expect(ipA).not.toBe(ipB);
  });

  it("prevents an attacker from bypassing limits by rotating spoofed x-forwarded-for headers off-Vercel", () => {
    const attack1 = request({ "user-agent": "AttackerBot/1.0", "x-forwarded-for": "1.1.1.1" });
    const attack2 = request({ "user-agent": "AttackerBot/1.0", "x-forwarded-for": "2.2.2.2" });

    // Both spoofed requests map to the identical untrusted bucket, preventing spoofing bypass
    expect(clientIp(attack1)).toBe(clientIp(attack2));
    expect(clientIp(attack1)).toMatch(/^untrusted:[a-f0-9]{16}$/);
  });

  it("guarantees independent users cannot exhaust each other's rate limits under untrusted networks", async () => {
    const userA = request({ "user-agent": "UserA-Browser" });
    const userB = request({ "user-agent": "UserB-Browser" });
    const keyA = `contact:${clientIp(userA)}`;
    const keyB = `contact:${clientIp(userB)}`;

    const testLimit = { limit: 2, windowSeconds: 60 };
    expect((await hitRateLimit(keyA, testLimit)).ok).toBe(true);
    expect((await hitRateLimit(keyA, testLimit)).ok).toBe(true);
    // User A hits their limit
    expect((await hitRateLimit(keyA, testLimit)).ok).toBe(false);

    // Independent User B must NOT be blocked by User A
    expect((await hitRateLimit(keyB, testLimit)).ok).toBe(true);
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

  it("gives separate keys separate counts: one user can't exhaust another's limit behind the same IP", async () => {
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

  it("magic links: limits per address and sends nothing once over, without storing the address", async () => {
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
