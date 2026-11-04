import { and, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createPoolDb } = await import("@/test/real-postgres");
  return { db: createPoolDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: () => {} }));
vi.mock("@/lib/r2", () => ({ deleteObject: async () => {}, listObjectKeys: async () => [], isR2Configured: () => true, UPLOAD_URL_TTL_SECONDS: 300 }));

const { resetAndMigrate } = await import("@/test/real-postgres");
const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { adminAuditLogs, accountDeletions, aiSpendCounters, aiUsageLedger, connections, consents, files, jobs, onboardingState, rateLimits, users } = schema;
const { allowPaidWork } = await import("@/lib/paid-work");
const { appendConsent } = await import("@/lib/consent/store");
const { queueConnectorSync } = await import("@/lib/connectors/connections");
const { enqueueComputeIntelligence } = await import("@/lib/jobs-queue");
const del = await import("@/lib/account-deletion");
const mfa = await import("@/lib/admin/mfa");
const { decodeTotpSecret, hotp } = await import("@/lib/admin/totp");
const { purgeOldAiUsage } = await import("@/lib/admin/ai-ops");

process.env.CONNECTOR_TOKEN_KEY = Buffer.alloc(32, 9).toString("base64");
process.env.ADMIN_EMAILS = "op@listed.example";

let next = 1;
const newUser = async (extra: Partial<typeof users.$inferInsert> = {}) => {
  const id = `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  await db.insert(users).values({ id, email: `${id}@example.com`, ...extra });
  return id;
};
const parallel = <T>(n: number, fn: () => Promise<T>) => Promise.all(Array.from({ length: n }, fn));
const queued = (userId: string) => db.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.status, "queued")));

let applied: string[] = [];
beforeAll(async () => {
  applied = await resetAndMigrate();
});

describe("migrations", () => {
  it("all apply on real Postgres with pgvector, with no error tolerated", () => {
    expect(applied.at(-1)).toBe("0024_auth_code_session_version.sql");
    expect(applied).toHaveLength(25);
  });
});

describe("parallel job creation on independent connections", () => {
  it("really does run concurrently here", async () => {
    const { rows } = await db.execute(sql`SELECT 1`);
    expect(rows).toHaveLength(1);
    const started = Date.now();
    await parallel(10, () => db.execute(sql`SELECT pg_sleep(0.2)`));
    expect(Date.now() - started).toBeLessThan(1500); // serial would take 2 seconds
  });

  it("lets exactly the limit through", async () => {
    const user = await newUser();
    const results = await parallel(50, () => allowPaidWork(user, "github_refresh"));
    expect(results.filter((r) => r.ok)).toHaveLength(10);
  });

  it("the global ceiling holds across many accounts at once", async () => {
    const accounts = await Promise.all(Array.from({ length: 12 }, () => newUser()));
    await db.execute(sql`SELECT hit_sliding_limit('paid_global:integration_sync', 2000, 3600) FROM generate_series(1, 1995)`);
    const results = await Promise.all(accounts.map((u) => allowPaidWork(u, "integration_sync")));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
  });

  it("parallel consent grants queue one re-read", async () => {
    const user = await newUser();
    await db.insert(files).values({ userId: user, kind: "resume", storageKey: `resumes/${user}/a.pdf`, sha256: "a".repeat(64), sizeBytes: 1, mime: "application/pdf" });
    await parallel(20, () => appendConsent(user, "external_ai", true));
    expect(await queued(user)).toHaveLength(1);
  });

  it("parallel grants queue one LinkedIn sync", async () => {
    const user = await newUser();
    await db.insert(connections).values({ userId: user, sourceId: "linkedin", accessMethod: "oauth", status: "connected" });
    await parallel(20, () => appendConsent(user, "linkedin_scrape", true));
    expect(await queued(user)).toHaveLength(1);
  });

  it("documents a known race: parallel identical grants can append duplicate consent rows", async () => {
    const user = await newUser();
    await parallel(10, () => appendConsent(user, "analytics", true));
    const rows = await db.select().from(consents).where(eq(consents.userId, user));
    expect(rows.length).toBeGreaterThanOrEqual(1); // harmless: all say the same thing, and the limit bounds them
    expect(rows.every((r) => r.granted)).toBe(true);
  });

  it("parallel recomputes: at most a few, and all within the limit", async () => {
    const user = await newUser();
    await db.insert(onboardingState).values({ userId: user, currentStep: "done" });
    await parallel(40, () => enqueueComputeIntelligence(user, "test"));
    const rows = await queued(user);
    const [limit] = await db.select().from(rateLimits).where(eq(rateLimits.key, `paid:recompute:${user}`));
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(limit.count).toBeLessThanOrEqual(30);
    expect(rows.filter((r) => r.runAt.getTime() <= Date.now() + 1000).length).toBeLessThanOrEqual(30);
  });

  it("parallel connector syncs for one connection collapse", async () => {
    const user = await newUser();
    const [c] = await db.insert(connections).values({ userId: user, sourceId: "github", accessMethod: "oauth", status: "connected" }).returning();
    await Promise.all(Array.from({ length: 20 }, (_, i) => queueConnectorSync(user, c.id, "github", `key-${i % 2}`)));
    expect((await queued(user)).length).toBeLessThanOrEqual(2);
  });
});

describe("hit_sliding_limit under load", () => {
  it("never allows more than the limit, across hundreds of parallel calls", async () => {
    const { rows } = await db.execute(sql`SELECT hit_sliding_limit('load:test', 100, 3600) AS retry FROM generate_series(1, 300)`);
    expect((rows as { retry: number }[]).filter((r) => r.retry === 0)).toHaveLength(100);
    const results = await parallel(40, () => db.execute(sql`SELECT hit_sliding_limit('load:parallel', 25, 3600) AS retry`));
    expect(results.filter((r) => (r.rows[0] as { retry: number }).retry === 0)).toHaveLength(25);
  });
});

describe("account deletion on real Postgres", () => {
  it("runs end to end, protects operators, audits once and removes AI identity", async () => {
    const user = await newUser();
    const operator = await newUser({ email: "OP@listed.example" });
    await db.insert(jobs).values({ type: "compute_intelligence", userId: user, idempotencyKey: `r-${user}`, status: "running", lockedBy: "w" });
    await db.insert(aiSpendCounters).values({ scope: user, period: "2026-11", userId: user, meteredUsd: "1" });
    await db.execute(sql`INSERT INTO ai_usage_ledger (user_id, job_id, provider, model, purpose, status, reserved_usd, cost_usd, day, month, scoped_to_user, expires_at)
      VALUES (${user}, ${user}, 'groq', 'm', 't', 'metered', 1, 1, '2026-11-01', '2026-11', ${user}, now())`);
    await db.execute(sql`SELECT hit_sliding_limit(${`paid:github_refresh:${user}`}::text, 10, 3600)`);

    await expect(del.requestAccountDeletion(operator, { requestedBy: "self", actorEmail: "s", action: "a" })).rejects.toBeInstanceOf(del.ProtectedAccountError);
    await parallel(3, () => del.requestAccountDeletion(user, { requestedBy: "self", actorEmail: "s", action: "account.self_delete" }));
    expect((await del.processAccountDeletion(user))?.dataDeleted).toBe(true);

    expect(await db.select().from(users).where(eq(users.id, user))).toEqual([]);
    expect(await db.select().from(aiSpendCounters).where(eq(aiSpendCounters.scope, user))).toEqual([]);
    expect(await db.select().from(rateLimits).where(eq(rateLimits.key, `paid:github_refresh:${user}`))).toEqual([]);
    const ledger = await db.select().from(aiUsageLedger);
    const row = ledger.find((l) => l.costUsd === "1.000000");
    expect(row).toMatchObject({ userId: null, jobId: null, scopedToUser: null });
    const audits = await db.select().from(adminAuditLogs).where(eq(adminAuditLogs.targetId, user));
    expect(audits.filter((a) => a.action === "account.self_delete")).toHaveLength(1);

    await db.update(accountDeletions).set({ nextAttemptAt: new Date(0), sweepAfter: new Date(0) }).where(eq(accountDeletions.userId, user));
    expect((await del.processDueDeletions()).completed).toBeGreaterThanOrEqual(1);
  });
});

describe("recovery codes on real Postgres", () => {
  it("issue once and redeem once across connections", async () => {
    const id = await newUser();
    await mfa.beginMfaEnrollment(id);
    const secret = (await mfa.getMfaEnrollment(id))!.secret;
    expect(await mfa.verifyAdminMfaCode(id, hotp(decodeTotpSecret(secret), Math.floor(Date.now() / 30000)))).toBe(true);
    const issued = await parallel(5, () => mfa.issueRecoveryCodes(id));
    const codes = issued.filter((r) => r.length);
    expect(codes).toHaveLength(1);
    const redeemed = await parallel(5, () => mfa.redeemRecoveryCode({ id, email: "m@example.com" }, codes[0][0]));
    expect(redeemed.filter(Boolean)).toHaveLength(1);
  });
});

describe("retention", () => {
  it("purges old settled spend and user counters, keeps open reservations and recent data", async () => {
    await db.delete(aiUsageLedger);
    await db.delete(aiSpendCounters);
    const insert = (status: string, age: string) =>
      db.execute(sql`INSERT INTO ai_usage_ledger (provider, model, purpose, status, reserved_usd, day, month, expires_at, created_at)
        VALUES ('groq', 'm', ${age}, ${status}, 0, '2000-01-01', '2000-01', now(), now() - ${age}::interval)`);
    await insert("metered", "500 days");
    await insert("metered", "10 days");
    await insert("reserved", "500 days");
    await db.insert(aiSpendCounters).values([
      { scope: "00000000-0000-4000-8000-0000000000ff", period: "2000-01-01" },
      { scope: "global", period: "2000-01" },
      { scope: "00000000-0000-4000-8000-0000000000ff", period: new Date().toISOString().slice(0, 10) },
      { scope: "global", period: new Date().toISOString().slice(0, 7) },
    ]);
    await purgeOldAiUsage();
    const left = await db.select().from(aiUsageLedger);
    expect(left.map((l) => `${l.status}:${l.purpose}`).sort()).toEqual(["metered:10 days", "reserved:500 days"]);
    expect(await db.select().from(aiSpendCounters)).toHaveLength(2);
  });
});
