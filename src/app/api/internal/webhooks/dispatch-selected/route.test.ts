/**
 * POST /api/internal/webhooks/dispatch-selected on PGlite: the real route, the real dispatcher.
 * Only outbound fetch is stubbed; account deletion and cleanup modules are spied to prove they never run.
 */
import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const INTERNAL = "internal-secret-0123456789abcdef0123456789abcdef";
const CRON = "cron-secret-0123456789abcdef";
process.env.INTERNAL_API_SECRET = INTERNAL;
process.env.CRON_SECRET = CRON;
process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.aitathastu.com/api/webhooks/tathastu";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "test-webhook-secret";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
const processDueDeletions = vi.fn();
const purgeOldAiUsage = vi.fn();
vi.mock("@/lib/account-deletion", async (orig) => ({ ...(await orig<object>()), processDueDeletions }));
vi.mock("@/lib/admin/ai-ops", async (orig) => ({ ...(await orig<object>()), purgeOldAiUsage }));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const route = await import("@/app/api/internal/webhooks/dispatch-selected/route");
const { saveConsent, revokeLink } = await import("@/lib/integrations/consent");

const ALL = { education: true, skills: true, eris: true, projects: true, experience: true, achievements: true, activity: true };

async function user(opts: { onboarded?: boolean; deleted?: boolean } = {}) {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, name: "U", email: `u-${id.slice(0, 8)}@example.com`, deletedAt: opts.deleted ? new Date() : null });
  await db.insert(schema.onboardingState).values({ userId: id, currentStep: opts.onboarded === false ? "resume" : "done" });
  await saveConsent(id, "collaborate", { scopes: ALL as never, link: true });
  return id;
}
const pending = (userId: string, event: "profile.updated" | "integration.revoked" = "profile.updated", reason = "reconcile") =>
  db.insert(schema.webhookOutbox).values({ clientId: "collaborate", userId, event, reason }).returning().then((r) => r[0]);
const row = (id: string) => db.select().from(schema.webhookOutbox).where(eq(schema.webhookOutbox.id, id)).then((r) => r[0]);
const call = (body: unknown, secret: string | null = INTERNAL) =>
  route.POST(
    new Request("https://www.aitathastu.com/api/internal/webhooks/dispatch-selected", {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { authorization: `Bearer ${secret}` } : {}) },
      body: JSON.stringify(body),
    }),
  );

let sent: { type: string; userId: string; profileId?: string }[] = [];
beforeEach(async () => {
  await db.delete(schema.webhookOutbox);
  await db.update(schema.featureFlags).set({ enabled: true }).where(eq(schema.featureFlags.key, "collaborate_profile_api"));
  sent = [];
  processDueDeletions.mockClear();
  purgeOldAiUsage.mockClear();
  vi.stubGlobal("fetch", async (_u: string, init: RequestInit) => {
    const b = JSON.parse(init.body as string);
    sent.push({ type: b.type, userId: b.data.userId, profileId: b.data.profile?.identity?.id });
    return new Response(null, { status: 204 });
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("authentication and input", () => {
  it("rejects no token, the cron secret, and a wrong token", async () => {
    const id = await user();
    for (const s of [null, CRON, "x".repeat(48)]) expect((await call({ userIds: [id], apply: true }, s)).status).toBe(401);
    expect(sent).toHaveLength(0);
  });

  it("accepts only 1-50 full UUIDs (no prefixes, no wildcards)", async () => {
    for (const userIds of [[], ["bd5e5fff"], ["%"], "all", Array.from({ length: 51 }, () => randomUUID())]) {
      expect((await call({ userIds, apply: true })).status).toBe(422);
    }
  });
});

describe("scope", () => {
  it("dry run (the default) lists exactly what would be sent and writes nothing", async () => {
    const a = await user();
    const ra = await pending(a);
    const res = await (await call({ userIds: [a] })).json();
    expect(res).toMatchObject({ dryRun: true, plan: [{ id: ra.id, userId: a }], results: [] });
    expect(await row(ra.id)).toMatchObject({ status: "pending", attempts: 0 });
    expect(sent).toHaveLength(0);
  });

  it("sends only the selected users' profile.updated; other users and other events stay untouched", async () => {
    const a = await user();
    const b = await user();
    const other = await user();
    const ra = await pending(a);
    const rb = await pending(b);
    const rOther = await pending(other);
    const rRevokeEvent = await pending(a, "integration.revoked", "user_disconnected");

    const res = await (await call({ userIds: [a, b], apply: true })).json();
    expect(res.results.map((r: { outcome: string }) => r.outcome)).toEqual(["delivered", "delivered"]);
    expect(sent.map((s) => `${s.type}:${s.userId}`).sort()).toEqual([`profile.updated:${a}`, `profile.updated:${b}`].sort());
    // In place: each payload is for the existing identity (the app matches on identity.id).
    expect(sent.every((s) => s.profileId === s.userId)).toBe(true);
    expect(await row(ra.id)).toMatchObject({ status: "delivered", attempts: 1 });
    expect(await row(rb.id)).toMatchObject({ status: "delivered", attempts: 1 });
    expect(await row(rOther.id)).toMatchObject({ status: "pending", attempts: 0 });
    expect(await row(rRevokeEvent.id)).toMatchObject({ status: "pending", attempts: 0 });
  });

  it("never runs account deletions or cleanup purges", async () => {
    const a = await user();
    await pending(a);
    const doomed = await user();
    await db.insert(schema.accountDeletions).values({ userId: doomed, requestedBy: "admin", status: "pending", nextAttemptAt: new Date(Date.now() - 86400000), sweepAfter: new Date(Date.now() - 86400000) });
    const old = new Date(Date.now() - 40 * 86400000);
    await db.insert(schema.rateLimits).values({ key: `rl-${a}`, windowStart: old, count: 1 });
    await db.insert(schema.verificationTokens).values({ identifier: `vt-${a}`, token: "t", expires: old });

    await call({ userIds: [a, doomed], apply: true });
    expect(processDueDeletions).not.toHaveBeenCalled();
    expect(purgeOldAiUsage).not.toHaveBeenCalled();
    const [del] = await db.select().from(schema.accountDeletions).where(eq(schema.accountDeletions.userId, doomed));
    expect(del).toMatchObject({ status: "pending", attempts: 0 });
    expect(await db.select().from(schema.rateLimits).where(eq(schema.rateLimits.key, `rl-${a}`))).toHaveLength(1);
    expect(await db.select().from(schema.verificationTokens).where(eq(schema.verificationTokens.identifier, `vt-${a}`))).toHaveLength(1);
    // The account being deleted is not sent anything either.
    expect(sent.some((s) => s.userId === doomed)).toBe(false);
  });
});

describe("eligibility and safety", () => {
  it("skips revoked, deleted and not-yet-onboarded users, and never sends them", async () => {
    const revoked = await user();
    const rr = await pending(revoked);
    await revokeLink(revoked, "collaborate");
    const deleted = await user({ deleted: true });
    const rd = await pending(deleted);
    const incomplete = await user({ onboarded: false });
    const ri = await pending(incomplete);
    const unknown = randomUUID();

    const res = await (await call({ userIds: [revoked, deleted, incomplete, unknown], apply: true })).json();
    expect(res.plan).toEqual([]);
    expect(Object.fromEntries(res.skipped.map((s: { userId: string; reason: string }) => [s.userId, s.reason]))).toEqual({
      [revoked]: "not linked (or revoked)",
      [deleted]: "account deleted",
      [incomplete]: "onboarding incomplete",
      [unknown]: "unknown user",
    });
    expect(sent.filter((s) => s.type === "profile.updated")).toHaveLength(0);
    for (const r of [rr, rd, ri]) expect((await row(r.id)).attempts).toBe(0);
  });

  it("re-checks consent at send time: revoked between plan and send is not delivered", async () => {
    const a = await user();
    const ra = await pending(a);
    await revokeLink(a, "collaborate"); // after the operator's dry run, before apply
    const res = await (await call({ userIds: [a], apply: true })).json();
    expect(res.results).toEqual([]);
    expect(sent).toHaveLength(0);
    expect((await row(ra.id)).status).toBe("pending");
  });

  it("is idempotent: a repeated call sends nothing more", async () => {
    const a = await user();
    await pending(a);
    await call({ userIds: [a], apply: true });
    const second = await (await call({ userIds: [a], apply: true })).json();
    expect(second.plan).toEqual([]);
    expect(second.skipped).toEqual([{ userId: a, reason: "no pending profile.updated" }]);
    expect(sent).toHaveLength(1);
  });

  it("a delivery in flight elsewhere is not sent twice", async () => {
    const a = await user();
    const ra = await pending(a);
    await db.update(schema.webhookOutbox).set({ status: "sending", attempts: 1, lockedUntil: new Date(Date.now() + 60_000) }).where(eq(schema.webhookOutbox.id, ra.id));
    const res = await (await call({ userIds: [a], apply: true })).json();
    expect(res.skipped).toEqual([{ userId: a, reason: "delivery already in flight" }]);
    expect(sent).toHaveLength(0);
  });

  it("a Collaborate failure is retried with backoff and recorded on the row", async () => {
    const a = await user();
    const ra = await pending(a);
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    const res = await (await call({ userIds: [a], apply: true })).json();
    expect(res.results).toEqual([{ id: ra.id, userId: a, outcome: "retrying" }]);
    const r = await row(ra.id);
    expect(r).toMatchObject({ status: "pending", attempts: 1, lastError: "HTTP 503" });
    expect(r.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 30_000);
  });
});
