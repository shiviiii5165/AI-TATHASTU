import { and, eq, like, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: () => {} }));

const { db } = await import("@/db");
const { aiCostBudgets, aiSpendCounters, connections, consents, files, jobs, rateLimits, users } = await import("@/db/schema");
const { allowPaidWork } = await import("@/lib/paid-work");
const { appendConsent, appendConsents } = await import("@/lib/consent/store");
const { getAiBudgetStatus, updateAiBudgetPolicy } = await import("@/lib/admin/ai-ops");

let next = 1;
const newId = () => `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;

async function seedUser() {
  const id = newId();
  await db.insert(users).values({ id, email: `${id}@example.com` });
  return id;
}

async function seedResumeUser() {
  const id = await seedUser();
  await db.insert(files).values({ userId: id, kind: "resume", storageKey: `resumes/${id}/a.pdf`, sha256: "a".repeat(64), sizeBytes: 1, mime: "application/pdf" });
  return id;
}

const jobsOf = (userId: string, type: "resume_extract" | "connector_sync") => db.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.type, type)));
const latestGrant = async (userId: string, purpose: "external_ai" | "linkedin_scrape") => {
  const rows = await db.select().from(consents).where(and(eq(consents.userId, userId), eq(consents.purpose, purpose)));
  return rows.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).at(-1)?.granted;
};
const toggle = async (userId: string, purpose: "external_ai" | "linkedin_scrape", times: number) => {
  for (let i = 0; i < times; i++) {
    await appendConsent(userId, purpose, true);
    await appendConsent(userId, purpose, false);
  }
};

beforeEach(async () => {
  await db.delete(rateLimits).where(like(rateLimits.key, "paid_global:%"));
  await db.execute(sql`SELECT 1`);
});

describe("consent toggling", () => {
  it("queues one AI re-read per file however often it's toggled", async () => {
    const user = await seedResumeUser();
    await toggle(user, "external_ai", 10);
    expect(await jobsOf(user, "resume_extract")).toHaveLength(1);
  });

  it("queues one even with parallel grants", async () => {
    const user = await seedResumeUser();
    await Promise.all(Array.from({ length: 10 }, () => appendConsent(user, "external_ai", true)));
    expect(await jobsOf(user, "resume_extract")).toHaveLength(1);
  });

  it("queues one connector sync per day per connection", async () => {
    const user = await seedUser();
    await db.insert(connections).values({ userId: user, sourceId: "linkedin", accessMethod: "oauth", status: "connected" });
    await toggle(user, "linkedin_scrape", 10);
    expect(await jobsOf(user, "connector_sync")).toHaveLength(1);
  });

  it("lets a failed re-read be retried by a later grant, but not a finished one", async () => {
    const user = await seedResumeUser();
    await appendConsent(user, "external_ai", true);
    await db.update(jobs).set({ status: "failed", attempts: 3, lastError: "provider outage" }).where(eq(jobs.userId, user));
    await appendConsent(user, "external_ai", false);
    await appendConsent(user, "external_ai", true);
    const [job] = await jobsOf(user, "resume_extract");
    expect(job).toMatchObject({ status: "queued", attempts: 0, lastError: null });

    await db.update(jobs).set({ status: "done" }).where(eq(jobs.userId, user));
    await appendConsent(user, "external_ai", false);
    await appendConsent(user, "external_ai", true);
    expect((await jobsOf(user, "resume_extract"))[0].status).toBe("done");
  });

  it("never revives a job cancelled by account deletion", async () => {
    const user = await seedResumeUser();
    await appendConsent(user, "external_ai", true);
    await db.update(jobs).set({ status: "failed", lastError: "Account deleted" }).where(eq(jobs.userId, user));
    await appendConsent(user, "external_ai", false);
    await appendConsent(user, "external_ai", true);
    expect((await jobsOf(user, "resume_extract"))[0].status).toBe("failed");
  });

  it("refuses new grants past the limit, leaving the answer as it was", async () => {
    const user = await seedUser();
    await toggle(user, "external_ai", 30);
    expect(await appendConsent(user, "external_ai", true)).toBe(false);
    expect(await latestGrant(user, "external_ai")).toBe(false);
  });

  it("always records a withdrawal, even past the limit", async () => {
    const user = await seedUser();
    await toggle(user, "external_ai", 29);
    expect(await appendConsent(user, "external_ai", true)).toBe(true);
    await db.execute(sql`SELECT hit_sliding_limit(${`paid:consent_grant:${user}`}::text, 30, 3600)`);
    expect(await appendConsent(user, "external_ai", false)).toBe(true);
    expect(await latestGrant(user, "external_ai")).toBe(false);
  });

  it("the batch writer records withdrawals while refusing grants", async () => {
    const user = await seedUser();
    await appendConsents(user, { external_ai: true, linkedin_scrape: false, analytics: false, mentor_discovery: false });
    await db.execute(sql`SELECT hit_sliding_limit(${`paid:consent_grant:${user}`}::text, 30, 3600) FROM generate_series(1, 30)`);
    const out = await appendConsents(user, { external_ai: false, linkedin_scrape: true, analytics: false, mentor_discovery: false });
    expect(out.refused).toEqual(["linkedin_scrape"]);
    expect(await latestGrant(user, "external_ai")).toBe(false);
    expect(await latestGrant(user, "linkedin_scrape")).toBe(false);
  });

  it("doesn't count an unchanged answer as a grant", async () => {
    const user = await seedResumeUser();
    await appendConsent(user, "external_ai", true);
    for (let i = 0; i < 50; i++) expect(await appendConsent(user, "external_ai", true)).toBe(true);
  });
});

describe("allowPaidWork", () => {
  it("lets exactly the limit through under parallel requests", async () => {
    const user = await seedUser();
    const results = await Promise.all(Array.from({ length: 25 }, () => allowPaidWork(user, "github_refresh")));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });

  it("keeps each account's count separate", async () => {
    const [a, b] = [await seedUser(), await seedUser()];
    for (let i = 0; i < 10; i++) await allowPaidWork(a, "integration_sync");
    expect((await allowPaidWork(a, "integration_sync")).ok).toBe(false);
    expect((await allowPaidWork(b, "integration_sync")).ok).toBe(true);
  });

  it("stops many accounts at the shared ceiling", async () => {
    await db.execute(sql`SELECT hit_sliding_limit('paid_global:integration_sync', 2000, 3600) FROM generate_series(1, 2000)`);
    expect((await allowPaidWork(await seedUser(), "integration_sync")).ok).toBe(false);
  });

  it("refuses when the count can't be made", async () => {
    const user = await seedUser();
    const execute = vi.spyOn(db, "execute").mockImplementationOnce(() => {
      throw new Error("database down");
    });
    expect((await allowPaidWork(user, "resume_extract")).ok).toBe(false);
    execute.mockRestore();
  });
});

describe("the sliding limit at window boundaries", () => {
  const LIMIT = 10;
  const WINDOW = 3600;
  let n = 0;
  const hit = async (key: string, at: number) => {
    const { rows } = await db.execute(sql`SELECT hit_sliding_limit(${key}::text, ${LIMIT}::int, ${WINDOW}::int, ${at}::bigint) AS retry`);
    return Number((rows[0] as { retry: number }).retry);
  };

  it("refuses the burst a fixed window would allow just after its boundary", async () => {
    const key = `boundary:${n++}`;
    const boundary = 1_800_000_000 - (1_800_000_000 % WINDOW);
    for (let i = 0; i < LIMIT; i++) expect(await hit(key, boundary - 1)).toBe(0);
    for (let i = 0; i < LIMIT; i++) expect(await hit(key, boundary + 1)).toBeGreaterThan(0);
  });

  it("recovers once the window has passed, and says when", async () => {
    const key = `recovers:${n++}`;
    const start = 1_800_000_000;
    for (let i = 0; i < LIMIT; i++) await hit(key, start);
    const retry = await hit(key, start + 1);
    expect(retry).toBeGreaterThan(0);
    expect(await hit(key, start + 1 + retry - 1)).toBeGreaterThan(0);
    expect(await hit(key, start + 1 + retry)).toBe(0);
  });

  it("doesn't let refused hits extend the wait", async () => {
    const key = `hammer:${n++}`;
    const start = 1_800_000_000;
    for (let i = 0; i < LIMIT; i++) await hit(key, start);
    for (let t = 1; t < WINDOW; t += 60) await hit(key, start + t);
    expect(await hit(key, start + WINDOW + 300)).toBe(0);
  });

  it("never allows more than the limit in any span of a window, under a hostile pattern", async () => {
    const key = `property:${n++}`;
    const allowed: number[] = [];
    let at = 1_800_000_000;
    // Dense hits around every bucket edge, for three windows.
    for (let t = 0; t < WINDOW * 3; t += 137) {
      at = 1_800_000_000 + t;
      if ((await hit(key, at)) === 0) allowed.push(at);
    }
    expect(allowed.length).toBeGreaterThan(LIMIT);
    for (const from of allowed) expect(allowed.filter((a) => a >= from && a < from + WINDOW).length).toBeLessThanOrEqual(LIMIT);
  });
});

describe("the admin budget view", () => {
  const month = new Date().toISOString().slice(0, 7);

  it("has no invented spend on a fresh database", async () => {
    const status = await getAiBudgetStatus();
    expect(status).toMatchObject({ meteredUsd: 0, estimatedUsd: 0, reservedUsd: 0, usedUsd: 0 });
    expect(Number(status.spentUsd)).toBe(0);
  });

  it("separates metered, estimated and reserved", async () => {
    await db.insert(aiSpendCounters).values({ scope: "global", period: month, meteredUsd: "1.5", estimatedUsd: "0.25", reservedUsd: "0.1" });
    const status = await getAiBudgetStatus();
    expect(status).toMatchObject({ meteredUsd: 1.5, estimatedUsd: 0.25, reservedUsd: 0.1 });
    expect(status.usedUsd).toBeCloseTo(1.85);
    await db.delete(aiSpendCounters).where(sql`true`);
  });

  it("saves per-user limits", async () => {
    await updateAiBudgetPolicy({ budgetUsd: 200, userDailyUsd: 2, userMonthlyUsd: 10, warningPercent: 75 }, "admin@example.com");
    const [row] = await db.select().from(aiCostBudgets);
    expect(row).toMatchObject({ budgetUsd: "200.00", userDailyUsd: "2.00", userMonthlyUsd: "10.00", warningThresholdPercent: 75 });
  });
});
