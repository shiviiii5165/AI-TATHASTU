/**
 * Backfill preview / reconciliation buckets (backfill-report.ts) on PGlite, together with the real backfill
 * (autoProvision) and dispatcher, so the counts are checked against what the backfill actually does.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTEGRATION_AVASAR_WEBHOOK_URL = "https://avsar.example.test/api/webhooks/tathastu";
process.env.INTEGRATION_AVASAR_WEBHOOK_SECRET = "avsar-webhook-secret-0123456789abcdef";
process.env.AVASAR_AUTO_PROVISION = "1";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: vi.fn() }));
vi.mock("@/lib/profile/unified", async (orig) => ({
  ...(await orig<typeof import("@/lib/profile/unified")>()),
  loadProfile: async (userId: string) => ({
    user: { id: userId, email: "x@example.invalid", name: "X", role: "student" },
    identity: {}, state: null, view: null, education: [], skills: [], projects: [], experience: [], facts: [], repos: [],
  }),
}));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { backfillReport } = await import("@/lib/integrations/backfill-report");
const { autoProvision, pendingProvisionUsers } = await import("@/lib/integrations/auto-provision");
const { dispatchWebhooks } = await import("@/lib/integrations/webhooks");

async function user(opts: { onboarded?: boolean; deleted?: boolean } = {}) {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, name: "U", email: `u-${id.slice(0, 8)}@example.com`, deletedAt: opts.deleted ? new Date() : null });
  await db.insert(schema.onboardingState).values({ userId: id, currentStep: opts.onboarded === false ? "resume" : "done" });
  return id;
}
const answer = (outcome: string, status = 200) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ result: { outcome, action: "TEST" } }), { status })));

beforeEach(async () => {
  for (const t of [schema.webhookOutbox, schema.integrationSyncState, schema.integrationConsentLog, schema.integrationConsents, schema.onboardingState]) await db.delete(t);
  await db.delete(schema.users);
  await db.update(schema.featureFlags).set({ enabled: true }).where(eq(schema.featureFlags.key, "avasar_profile_api"));
});
afterEach(() => vi.unstubAllGlobals());

describe("backfill preview and reconciliation", () => {
  it("dry run: every account in exactly one bucket; deleted accounts are skipped, never eligible", async () => {
    const live = [await user(), await user(), await user({ onboarded: false })];
    await user({ deleted: true });
    const r = await backfillReport("avasar");
    expect(r).toMatchObject({ total: 4, deleted: 1, eligible: 3, alreadySynced: 0 });
    expect((await pendingProvisionUsers("avasar", 100)).sort()).toEqual(live.sort());
  });

  it("after backfill + delivery: synced, failed and onboarding-incomplete are counted apart; buckets sum to total", async () => {
    const ok = await user();
    const rejected = await user();
    const notOnboarded = await user({ onboarded: false });
    for (const id of [ok, rejected, notOnboarded]) await autoProvision(id, "avasar", "backfill");
    expect((await backfillReport("avasar")).inFlight).toBe(3);

    // The receiver confirms one and rejects the other; the not-onboarded user's row is withheld from delivery here.
    await db.delete(schema.webhookOutbox).where(eq(schema.webhookOutbox.userId, notOnboarded));
    answer("updated");
    await dispatchWebhooks(1);
    answer("rejected");
    await dispatchWebhooks(10);

    const r = await backfillReport("avasar");
    expect(r.alreadySynced).toBe(1);
    expect(r.failed).toBe(1);
    expect(r.eligible).toBe(0);
    const sum = r.deleted + r.eligible + r.alreadySynced + r.inFlight + r.onboardingIncomplete + r.failed + r.conflict + r.unconfirmed;
    expect(sum).toBe(r.total);
  });

  it("idempotent: provisioning an already-linked account again changes nothing and queues nothing", async () => {
    const id = await user();
    expect(await autoProvision(id, "avasar", "backfill")).toBe(true);
    expect(await autoProvision(id, "avasar", "backfill")).toBe(false);
    expect(await db.select().from(schema.webhookOutbox).where(eq(schema.webhookOutbox.userId, id))).toHaveLength(1);
    expect(await pendingProvisionUsers("avasar", 100)).not.toContain(id);
  });

  it("pagination / resume: a limited run takes the oldest first and the next run continues with the rest", async () => {
    const ids = [await user(), await user(), await user()];
    const first = await pendingProvisionUsers("avasar", 2);
    expect(first).toHaveLength(2);
    for (const id of first) await autoProvision(id, "avasar", "backfill"); // then "interrupted"
    const rest = await pendingProvisionUsers("avasar", 2);
    expect(rest).toHaveLength(1);
    expect(new Set([...first, ...rest])).toEqual(new Set(ids));
  });
});
