import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.aitathastu.com/api/webhooks/tathastu";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "test-webhook-secret";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: vi.fn() }));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { autoProvisionCollaborate, provisionPendingUsers, queueWeeklyRefresh, isoWeek } = await import("@/lib/integrations/auto-provision");
const { saveConsent, revokeLink, getConsent } = await import("@/lib/integrations/consent");

async function user(name: string, extra: Partial<typeof schema.users.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, name, email: `${name}-${id.slice(0, 6)}@example.com`, ...extra });
  return id;
}
const outbox = (userId: string) =>
  db.select().from(schema.webhookOutbox).where(and(eq(schema.webhookOutbox.userId, userId), eq(schema.webhookOutbox.clientId, "collaborate")));

beforeEach(() => {
  process.env.COLLABORATE_AUTO_PROVISION = "1";
});

describe("Collaborate auto-provisioning", () => {
  it("is on by default; COLLABORATE_AUTO_PROVISION=0 is an operator kill switch", async () => {
    process.env.COLLABORATE_AUTO_PROVISION = "0";
    const id = await user("off");
    expect(await autoProvisionCollaborate(id)).toBe(false);
    expect(await getConsent(id, "collaborate")).toBeNull();
    delete process.env.COLLABORATE_AUTO_PROVISION;
    expect(await autoProvisionCollaborate(id)).toBe(true);
  });

  it("links a user under consent policy v4 (everything shared, public profile) and queues a profile webhook", async () => {
    const id = await user("fresh");
    expect(await autoProvisionCollaborate(id)).toBe(true);
    const c = await getConsent(id, "collaborate");
    expect(c?.linkedAt).toBeTruthy();
    expect(c?.revokedAt).toBeNull();
    expect(c!.scopes).toEqual({ skills: true, projects: true, experience: true, education: true, achievements: true, eris: true, activity: true, discovery: true });
    expect(c!.source).toBe("auto_provision");
    expect(c!.policyVersion).toBe(4);
    const rows = await outbox(id);
    expect(rows.some((r) => r.event === "profile.updated" && r.reason === "auto_provision")).toBe(true);
  });

  it("brings an older narrower choice or a disconnect back onto policy v4; a second run changes nothing", async () => {
    const chose = await user("chose");
    await saveConsent(chose, "collaborate", { scopes: { skills: true } as never, link: true });
    const revoked = await user("revoked");
    await saveConsent(revoked, "collaborate", { scopes: { skills: true } as never, link: true });
    await revokeLink(revoked, "collaborate");
    expect(await autoProvisionCollaborate(chose)).toBe(true);
    expect(await autoProvisionCollaborate(revoked)).toBe(true);
    expect((await getConsent(chose, "collaborate"))!.scopes.eris).toBe(true);
    expect((await getConsent(revoked, "collaborate"))!.revokedAt).toBeNull();
    expect(await autoProvisionCollaborate(chose)).toBe(false); // idempotent
  });
  it("provisions pending existing users, skipping deleted accounts and those already decided", async () => {
    const a = await user("pending-a");
    const deleted = await user("deleted", { deletedAt: new Date() });
    const n = await provisionPendingUsers(1000);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await getConsent(a, "collaborate")).not.toBeNull();
    expect(await getConsent(deleted, "collaborate")).toBeNull();
    expect(await provisionPendingUsers(1000)).toBe(0); // idempotent
  });

  it("weekly refresh queues one sync per stale connection per week", async () => {
    const id = await user("weekly");
    const [stale] = await db.insert(schema.connections).values({ userId: id, sourceId: "github", accessMethod: "oauth", lastSyncAt: new Date(Date.now() - 8 * 86400000) }).returning();
    await db.insert(schema.connections).values({ userId: id, sourceId: "leetcode", accessMethod: "public_scrape", lastSyncAt: new Date() });
    await db.insert(schema.connections).values({ userId: id, sourceId: "kaggle", accessMethod: "api_key", status: "reauth_needed", lastSyncAt: null });
    await queueWeeklyRefresh();
    await queueWeeklyRefresh(); // same week: no duplicate
    const jobs = await db.select().from(schema.jobs).where(and(eq(schema.jobs.userId, id), eq(schema.jobs.type, "connector_sync")));
    expect(jobs).toHaveLength(1);
    expect(jobs[0].idempotencyKey).toBe(`connector_sync:${stale.id}:weekly:${isoWeek()}`);
  });
});
