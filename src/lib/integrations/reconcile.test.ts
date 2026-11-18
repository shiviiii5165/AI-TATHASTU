/**
 * Profile sync reconciliation (src/lib/integrations/reconcile.ts) on PGlite, through to the real
 * dispatcher (webhooks.ts). Only outbound fetch is stubbed.
 */
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.aitathastu.com/api/webhooks/tathastu";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "test-webhook-secret";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { findStaleProfileSyncs, reconcileProfileSyncs } = await import("@/lib/integrations/reconcile");
const { saveConsent, revokeLink } = await import("@/lib/integrations/consent");
const { dispatchWebhooks } = await import("@/lib/integrations/webhooks");

const HOUR = 3600_000;
const ago = (h: number) => new Date(Date.now() - h * HOUR);
const ALL = { education: true, skills: true, eris: true, projects: true, experience: true, achievements: true, activity: true };

async function user(opts: { onboarded?: boolean; deleted?: boolean; linked?: boolean; scopes?: Record<string, boolean> } = {}) {
  const { onboarded = true, deleted = false, linked = true, scopes = { skills: true } } = opts;
  const id = randomUUID();
  await db.insert(schema.users).values({ id, name: "U", email: `u-${id.slice(0, 8)}@example.com`, deletedAt: deleted ? new Date() : null });
  await db.insert(schema.onboardingState).values({ userId: id, currentStep: onboarded ? "done" : "resume", completedAt: onboarded ? ago(48) : null });
  if (linked) await saveConsent(id, "collaborate", { scopes: scopes as never, link: true });
  return id;
}
const computed = (userId: string, at: Date) =>
  db.insert(schema.jobs).values({ type: "compute_intelligence", userId, idempotencyKey: `ci:${randomUUID()}`, status: "done", finishedAt: at });
const delivered = (userId: string, queuedAt: Date, deliveredAt = queuedAt) =>
  db.insert(schema.webhookOutbox).values({ clientId: "collaborate", userId, event: "profile.updated", reason: "auto_provision", status: "delivered", createdAt: queuedAt, deliveredAt });
const outboxFor = (userId: string, status?: "pending" | "delivered" | "failed") =>
  db
    .select()
    .from(schema.webhookOutbox)
    .where(and(eq(schema.webhookOutbox.userId, userId), status ? eq(schema.webhookOutbox.status, status) : undefined));
const causeOf = async (id: string) => (await findStaleProfileSyncs("collaborate")).find((s) => s.userId === id)?.cause;

beforeEach(async () => {
  await db.delete(schema.webhookOutbox);
  await db.update(schema.featureFlags).set({ enabled: true }).where(eq(schema.featureFlags.key, "collaborate_profile_api"));
});
afterEach(() => vi.unstubAllGlobals());

describe("which users are stale", () => {
  it("a profile recomputed after the last delivery (the production gap)", async () => {
    const id = await user();
    await delivered(id, ago(40));
    await computed(id, ago(1));
    expect(await causeOf(id)).toBe("recomputed_since_delivery");
  });

  it("a linked, onboarded user who was never sent a profile", async () => {
    expect(await causeOf(await user())).toBe("never_delivered");
  });

  it("a user who finished onboarding after their only delivery (the empty sign-up payload)", async () => {
    const id = await user();
    await delivered(id, ago(50)); // provisioned at sign-up; onboarding completed 48h ago
    expect(await causeOf(id)).toBe("onboarded_since_delivery");
  });

  it("a recompute that finished while a delivery was in flight is not missed", async () => {
    const id = await user();
    // queued 3h ago, recompute finished 2h ago, delivered 1h ago: the payload may predate the recompute
    await delivered(id, ago(3), ago(1));
    await computed(id, ago(2));
    expect(await causeOf(id)).toBe("recomputed_since_delivery");
  });

  it("a delivery that failed for good after the last success is retried", async () => {
    const id = await user();
    await delivered(id, ago(30));
    await db.insert(schema.webhookOutbox).values({ clientId: "collaborate", userId: id, event: "profile.updated", status: "failed", lastError: "HTTP 500", createdAt: ago(5) });
    expect(await causeOf(id)).toBe("failed_since_delivery");
  });

  it("an up-to-date user is left alone", async () => {
    const id = await user();
    await computed(id, ago(10));
    await delivered(id, ago(5));
    expect(await causeOf(id)).toBeUndefined();
  });

  it("never: revoked links, unlinked users, incomplete onboarding, deleted accounts", async () => {
    const revoked = await user();
    await revokeLink(revoked, "collaborate");
    const unlinked = await user({ linked: false });
    const incomplete = await user({ onboarded: false });
    const deleted = await user({ deleted: true });
    for (const id of [revoked, unlinked, incomplete, deleted]) await computed(id, ago(1));
    const ids = (await findStaleProfileSyncs("collaborate")).map((s) => s.userId);
    for (const id of [revoked, unlinked, incomplete, deleted]) expect(ids).not.toContain(id);
  });
});

describe("queueing", () => {
  it("is idempotent: a second run, or a user with a pending row, queues nothing more", async () => {
    const id = await user();
    await computed(id, ago(1));
    await reconcileProfileSyncs("collaborate");
    const second = await reconcileProfileSyncs("collaborate");
    expect(second.stale.some((s) => s.userId === id)).toBe(false);
    const pending = await outboxFor(id, "pending");
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ event: "profile.updated", reason: "reconcile", clientId: "collaborate" });
  });

  it("dry run reports without writing", async () => {
    const id = await user();
    await computed(id, ago(1));
    const r = await reconcileProfileSyncs("collaborate", { apply: false });
    expect(r.stale.some((s) => s.userId === id)).toBe(true);
    expect(r.byCause.never_delivered).toBeGreaterThanOrEqual(1);
    expect(r.queued).toBe(0);
    expect(await outboxFor(id)).toHaveLength(0);
  });

  it("warns (not silent) when recomputed profiles had not been sent", async () => {
    const id = await user();
    await delivered(id, ago(40));
    await computed(id, ago(1));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await reconcileProfileSyncs("collaborate");
    expect(warn.mock.calls.flat().join(" ")).toMatch(/recomputed profile\(s\) had not been sent/);
    warn.mockRestore();
  });

  it("does nothing for an app whose webhook is not configured", async () => {
    const id = await user();
    await saveConsent(id, "meet", { scopes: { skills: true } as never, link: true });
    await computed(id, ago(1));
    const r = await reconcileProfileSyncs("meet");
    expect(r.skipped).toBe("webhook_not_configured");
    expect(r.queued).toBe(0);
  });
});

describe("reconcile → dispatch (existing delivery path)", () => {
  it("delivers once, signed, then the user is up to date", async () => {
    const id = await user({ scopes: ALL });
    await delivered(id, ago(40));
    await computed(id, ago(1));
    await reconcileProfileSyncs("collaborate");

    const bodies: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      bodies.push(init.body as string);
      expect((init.headers as Record<string, string>)["X-AIT-Signature"]).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
      return new Response(null, { status: 204 });
    });
    await dispatchWebhooks(100);
    const mine = bodies.map((b) => JSON.parse(b)).filter((b) => b.data.userId === id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ type: "profile.updated", data: { reason: "reconcile", profile: { schema: "ProfessionalProjectionV1" } } });
    expect(await causeOf(id)).toBeUndefined();
    expect((await reconcileProfileSyncs("collaborate")).stale.some((s) => s.userId === id)).toBe(false);
  });

  it("a temporary Collaborate outage is retried with backoff and stays visible", async () => {
    const id = await user();
    await computed(id, ago(1));
    await reconcileProfileSyncs("collaborate");
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    await dispatchWebhooks(100);
    const [row] = await outboxFor(id);
    expect(row).toMatchObject({ status: "pending", lastError: "HTTP 503", attempts: 1 });
    // Still covered by the pending row: reconcile doesn't stack a duplicate.
    expect(await causeOf(id)).toBeUndefined();
  });

  it("a user who disconnects after being queued is never sent a profile", async () => {
    const id = await user({ scopes: ALL });
    await computed(id, ago(1));
    await reconcileProfileSyncs("collaborate");
    await revokeLink(id, "collaborate");
    const sentFor: string[] = [];
    vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
      const b = JSON.parse(init.body as string);
      sentFor.push(`${b.type}:${b.data.userId}`);
      return new Response(null, { status: 204 });
    });
    await dispatchWebhooks(100);
    expect(sentFor).not.toContain(`profile.updated:${id}`);
    const rows = await outboxFor(id);
    expect(rows.find((r) => r.event === "profile.updated")).toMatchObject({ status: "failed", lastError: "app is no longer linked" });
  });
});
