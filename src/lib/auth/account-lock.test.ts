import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const { rateLimits, users } = await import("@/db/schema");
const { isSignInLocked, liveSessionVersion } = await import("./account-lock");
const { allowAuthAttempt } = await import("./abuse");

const LIVE = "00000000-0000-4000-8000-000000000001";
const GONE = "00000000-0000-4000-8000-000000000002";
const PROVIDER_ID = "00000000-0000-4000-8000-0000000000ff";

beforeAll(async () => {
  await db.insert(users).values([
    { id: LIVE, email: "live@example.com", sessionVersion: 3 },
    { id: GONE, email: "gone@example.com", deletedAt: new Date() },
  ]);
});

describe("isSignInLocked", () => {
  it("catches an unlinked OAuth identity by address, though its id means nothing", async () => {
    expect(await isSignInLocked({ id: PROVIDER_ID, email: "GONE@example.com " })).toBe(true);
  });

  it("catches a linked or magic-link user by id", async () => {
    expect(await isSignInLocked({ id: GONE, email: null })).toBe(true);
  });

  it("leaves everyone else alone, including a brand new address", async () => {
    expect(await isSignInLocked({ id: LIVE, email: "live@example.com" })).toBe(false);
    expect(await isSignInLocked({ id: PROVIDER_ID, email: "new@example.com" })).toBe(false);
  });

  it("ignores a provider's non-uuid id instead of failing the query", async () => {
    expect(await isSignInLocked({ id: "google-sub-123", email: "new@example.com" })).toBe(false);
  });
});

describe("liveSessionVersion", () => {
  it("is the version for a live account and null for a deleted or missing one, even if the token matches", async () => {
    expect(await liveSessionVersion(LIVE)).toBe(3);
    expect(await liveSessionVersion(GONE)).toBeNull();
    expect(await liveSessionVersion(PROVIDER_ID)).toBeNull();
  });
});

describe("allowAuthAttempt", () => {
  const attempt = (headers: Record<string, string> = {}) => allowAuthAttempt(new Request("https://app.test/api/auth/signin/google", { headers }));

  it("stops at the limit and can't be escaped by spoofing a forwarding header", async () => {
    // Off Vercel with no trusted proxy, forwarding headers are ignored: every caller shares one bucket.
    const results = [];
    for (let i = 0; i < 301; i++) results.push(await attempt({ "x-forwarded-for": `203.0.113.${i % 250}` }));
    expect(results.filter(Boolean)).toHaveLength(300);
    expect(results.at(-1)).toBe(false);
  });

  it("counts verified addresses separately on the platform", async () => {
    await db.delete(rateLimits);
    vi.stubEnv("VERCEL", "1");
    for (let i = 0; i < 300; i++) await attempt({ "x-vercel-forwarded-for": "198.51.100.1" });
    expect(await attempt({ "x-vercel-forwarded-for": "198.51.100.1" })).toBe(false);
    expect(await attempt({ "x-vercel-forwarded-for": "198.51.100.2" })).toBe(true);
    vi.unstubAllEnvs();
  });

  it("refuses when the count can't be made", async () => {
    const insert = vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("database down");
    });
    expect(await attempt()).toBe(false);
    insert.mockRestore();
  });
});
