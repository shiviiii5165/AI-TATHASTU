/**
 * Cross-app sync on real Postgres with independent connections: what PGlite's single connection can't prove.
 * Concurrent provisioning, concurrent dispatchers and concurrent repair must never duplicate consent, outbox rows
 * or deliveries. Needs TEST_POSTGRES_URL at a throwaway local database (npm run test:pg).
 */
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.example.test/api/webhooks/tathastu";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "collab-webhook-secret";
process.env.INTEGRATION_AVASAR_WEBHOOK_URL = "https://avsar.example.test/api/webhooks/tathastu";
process.env.INTEGRATION_AVASAR_WEBHOOK_SECRET = "avsar-webhook-secret";
process.env.COLLABORATE_AUTO_PROVISION = "1";
process.env.AVASAR_AUTO_PROVISION = "1";
process.env.AVASAR_AUTO_PROVISION_BACKFILL = "1";

vi.mock("@/db", async () => {
  const { createPoolDb } = await import("@/test/real-postgres");
  return { db: createPoolDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: vi.fn() }));
vi.mock("@/lib/profile/unified", async (orig) => ({
  ...(await orig<typeof import("@/lib/profile/unified")>()),
  loadProfile: async (userId: string) => ({
    user: { id: userId, email: "x@example.invalid", name: "X", role: "student" },
    identity: {}, state: null, view: null, education: [], skills: [], projects: [], experience: [], facts: [], repos: [],
  }),
}));

const { resetAndMigrate } = await import("@/test/real-postgres");
const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { autoProvision, autoProvisionNewUser, provisionPendingUsers } = await import("@/lib/integrations/auto-provision");
const { dispatchWebhooks } = await import("@/lib/integrations/webhooks");
const { repairMissingProfiles } = await import("@/lib/integrations/repair");
const { getSyncStates } = await import("@/lib/integrations/sync-state");

let deliveries: string[] = [];

beforeAll(async () => {
  await resetAndMigrate();
  await db.update(schema.featureFlags).set({ enabled: true });
});
beforeEach(() => {
  deliveries = [];
  vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(init.body as string);
    deliveries.push(body.id);
    await new Promise((r) => setTimeout(r, 15)); // hold the row while other dispatchers run
    return new Response(JSON.stringify({ result: { outcome: "created", action: "AUTO_PROVISIONED_PRIVATE" } }), { status: 200 });
  });
});

async function user() {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, email: `p-${id.slice(0, 8)}@example.com` });
  return id;
}

describe("on independent connections", () => {
  it("signup provisioning racing the weekly backfill links each app once and queues one row per app", async () => {
    const id = await user();
    const results = await Promise.allSettled([autoProvisionNewUser(id), provisionPendingUsers(1000), autoProvision(id, "avasar"), autoProvision(id, "collaborate")]);
    expect(results.every((r) => r.status === "fulfilled" || /duplicate key|unique/i.test(String((r as PromiseRejectedResult).reason)))).toBe(true);
    for (const app of ["collaborate", "avasar"] as const) {
      const consents = await db.select().from(schema.integrationConsents).where(and(eq(schema.integrationConsents.userId, id), eq(schema.integrationConsents.clientId, app)));
      expect(consents).toHaveLength(1);
      const pending = await db
        .select()
        .from(schema.webhookOutbox)
        .where(and(eq(schema.webhookOutbox.userId, id), eq(schema.webhookOutbox.clientId, app), eq(schema.webhookOutbox.status, "pending")));
      expect(pending).toHaveLength(1);
    }
  });

  it("four dispatchers at once deliver every row exactly once and record one confirmed status per app", async () => {
    const ids = await Promise.all(Array.from({ length: 6 }, () => user()));
    for (const id of ids) await autoProvisionNewUser(id);
    await Promise.all([dispatchWebhooks(100), dispatchWebhooks(100), dispatchWebhooks(100), dispatchWebhooks(100)]);
    expect(new Set(deliveries).size).toBe(deliveries.length); // no delivery id sent twice
    for (const id of ids) {
      const states = await getSyncStates(id);
      expect(states.get("collaborate")?.status).toBe("synced");
      expect(states.get("avasar")?.status).toBe("synced");
      const rows = await db.select().from(schema.webhookOutbox).where(eq(schema.webhookOutbox.userId, id));
      expect(rows.every((r) => r.status === "delivered" && r.outcome === "created" && r.attempts === 1)).toBe(true);
    }
  });

  it("two repairs at once queue at most one row per user (the pending-row unique index holds)", async () => {
    const id = await user();
    await db.insert(schema.integrationConsents).values({ userId: id, clientId: "avasar", scopes: { skills: true }, linkedAt: new Date() });
    await Promise.all([repairMissingProfiles("avasar", { apply: true, userIds: [id] }), repairMissingProfiles("avasar", { apply: true, userIds: [id] })]);
    const pending = await db
      .select()
      .from(schema.webhookOutbox)
      .where(and(eq(schema.webhookOutbox.userId, id), eq(schema.webhookOutbox.clientId, "avasar"), eq(schema.webhookOutbox.status, "pending")));
    expect(pending).toHaveLength(1);
  });

  it("the consent log trigger rejects updates on real Postgres too", async () => {
    const id = await user();
    await autoProvision(id, "avasar");
    const error = await db
      .update(schema.integrationConsentLog)
      .set({ linked: false })
      .where(eq(schema.integrationConsentLog.userId, id))
      .then(() => null, (e: unknown) => e as Error & { cause?: Error });
    expect(String(error?.cause?.message ?? error?.message)).toMatch(/immutable/);
  });
});
