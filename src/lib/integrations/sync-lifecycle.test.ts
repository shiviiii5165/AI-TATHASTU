/**
 * Cross-app profile sync, sender side (Collaborate and Avsar): signup provisioning of both apps, consent policy v2
 * and its log, the receiver's outcome deciding the sync status (an HTTP 200 alone is never "synced"), retries,
 * conflicts, deletion propagation, repair, and the backfill flags. Real PGlite with every migration; only the
 * outbound fetch to the apps is stubbed.
 */
import { randomUUID } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.example.test/api/webhooks/tathastu";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "collab-webhook-secret";
process.env.INTEGRATION_AVASAR_WEBHOOK_URL = "https://avsar.example.test/api/webhooks/tathastu";
process.env.INTEGRATION_AVASAR_WEBHOOK_SECRET = "avsar-webhook-secret";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: vi.fn() }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: async () => true }));
vi.mock("@/lib/profile/unified", async (orig) => ({
  ...(await orig<typeof import("@/lib/profile/unified")>()),
  // The projection's content is covered elsewhere; here only who receives what, and what the app answers.
  loadProfile: async (userId: string) => ({
    user: { id: userId, email: "x@example.invalid", name: "X", role: "student" },
    identity: {}, state: null, view: null, education: [], skills: [], projects: [], experience: [], facts: [], repos: [],
  }),
}));

const { db } = await import("@/db");
const schema = await import("@/db/schema");
const { autoProvision, autoProvisionNewUser, provisionPendingUsers, pendingProvisionUsers } = await import("@/lib/integrations/auto-provision");
const { getConsent, revokeLink, saveConsent } = await import("@/lib/integrations/consent");
const { dispatchWebhooks, enqueueProfileUpdated, enqueueRevoked, enqueueRevokedForDeletion } = await import("@/lib/integrations/webhooks");
const { getSyncStates } = await import("@/lib/integrations/sync-state");
const { findRepairCandidates, repairMissingProfiles } = await import("@/lib/integrations/repair");

type Answer = { status?: number; outcome?: string; action?: string; wrap?: boolean } | "network";
/** What each app answers next, per user (default: created/updated). */
let answers: Record<string, Answer[]> = {};
let sent: { app: string; type: string; userId: string; reason: string; body: Record<string, unknown> }[] = [];

function stubApps() {
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const app = url.includes("avsar") ? "avasar" : "collaborate";
    const body = JSON.parse(init.body as string);
    sent.push({ app, type: body.type, userId: body.data.userId, reason: body.data.reason, body });
    const queue = answers[`${app}:${body.data.userId}`];
    const a: Answer = queue?.length ? queue.shift()! : { outcome: body.type === "integration.revoked" ? "deleted" : "updated" };
    if (a === "network") throw new TypeError("fetch failed");
    const payload = { outcome: a.outcome, action: a.action ?? "X" };
    return new Response(JSON.stringify(a.wrap === false ? payload : { success: (a.status ?? 200) === 200, result: payload }), { status: a.status ?? 200 });
  });
}

async function user(extra: Partial<typeof schema.users.$inferInsert> = {}) {
  const id = randomUUID();
  await db.insert(schema.users).values({ id, name: "U", email: `u-${id.slice(0, 8)}@example.com`, ...extra });
  return id;
}
const state = async (id: string, app: "collaborate" | "avasar") => (await getSyncStates(id)).get(app);
const rows = (id: string, app: string) =>
  db.select().from(schema.webhookOutbox).where(and(eq(schema.webhookOutbox.userId, id), eq(schema.webhookOutbox.clientId, app as never)));
/** Makes every queued row for this user due now (retries wait for backoff otherwise). */
const makeDue = (id: string) => db.update(schema.webhookOutbox).set({ nextAttemptAt: new Date(0) }).where(eq(schema.webhookOutbox.userId, id));

beforeEach(() => {
  answers = {};
  sent = [];
  process.env.COLLABORATE_AUTO_PROVISION = "1";
  process.env.AVASAR_AUTO_PROVISION = "1";
  delete process.env.AVASAR_AUTO_PROVISION_BACKFILL;
  stubApps();
});
afterEach(() => vi.unstubAllGlobals());

describe("signup provisions both apps", () => {
  it("creates a linked consent for Collaborate AND Avsar with policy v2, logs it, and both apps get auto_provision", async () => {
    const id = await user();
    answers[`collaborate:${id}`] = [{ outcome: "created" }];
    answers[`avasar:${id}`] = [{ outcome: "created" }];
    expect(await autoProvisionNewUser(id)).toEqual(["collaborate", "avasar"]);
    for (const app of ["collaborate", "avasar"] as const) {
      const c = await getConsent(id, app);
      expect(c?.linkedAt).toBeTruthy();
      expect(c!.scopes.eris).toBe(false);
      expect(c!.scopes.activity).toBe(false);
      expect(c!.scopes.skills).toBe(true);
      expect((await state(id, app))?.status).toBe("pending");
    }
    const log = await db.select().from(schema.integrationConsentLog).where(eq(schema.integrationConsentLog.userId, id));
    expect(log.map((l) => [l.clientId, l.source, l.policyVersion, l.linked]).sort()).toEqual([
      ["avasar", "auto_provision", 2, true],
      ["collaborate", "auto_provision", 2, true],
    ]);
    await dispatchWebhooks(100);
    expect(sent.filter((s) => s.userId === id).map((s) => `${s.app}:${s.reason}`).sort()).toEqual(["avasar:auto_provision", "collaborate:auto_provision"]);
    expect((await state(id, "collaborate"))?.status).toBe("synced");
    expect((await state(id, "avasar"))?.status).toBe("synced");
    expect((await state(id, "avasar"))?.lastSuccessAt).toBeTruthy();
  });

  it("the shared projection never carries Career Intelligence when it is off", async () => {
    const id = await user();
    await autoProvisionNewUser(id);
    await dispatchWebhooks(100);
    for (const s of sent.filter((x) => x.userId === id)) {
      const profile = (s.body.data as { profile: Record<string, unknown> }).profile;
      expect(profile.goals).toBeNull();
      expect(profile.activity).toBeNull();
      expect(JSON.stringify(profile)).not.toMatch(/phone|resumeText|password/i);
    }
  });

  it("an app switched off for signups is skipped; the other is still provisioned", async () => {
    delete process.env.AVASAR_AUTO_PROVISION;
    const id = await user();
    expect(await autoProvisionNewUser(id)).toEqual(["collaborate"]);
    expect(await getConsent(id, "avasar")).toBeNull();
  });

  it("signup is idempotent: a second run provisions nothing and queues nothing new", async () => {
    const id = await user();
    await autoProvisionNewUser(id);
    expect(await autoProvisionNewUser(id)).toEqual([]);
    expect((await rows(id, "avasar")).length).toBe(1);
  });

  it("one app down at signup: the other syncs; the down app retries and then syncs", async () => {
    const id = await user();
    answers[`avasar:${id}`] = ["network", { outcome: "created" }];
    await autoProvisionNewUser(id);
    await dispatchWebhooks(100);
    expect((await state(id, "collaborate"))?.status).toBe("synced");
    expect((await state(id, "avasar"))?.status).toBe("pending");
    const [r] = await rows(id, "avasar");
    expect(r.status).toBe("pending");
    expect(r.attempts).toBe(1);
    await makeDue(id);
    await dispatchWebhooks(100);
    expect((await state(id, "avasar"))?.status).toBe("synced");
  });

  it("both apps down: nothing is lost; retries continue until retries run out, then status is failed", async () => {
    const id = await user();
    answers[`collaborate:${id}`] = Array(10).fill({ status: 503, outcome: "retryable" });
    answers[`avasar:${id}`] = Array(10).fill("network");
    await autoProvisionNewUser(id);
    for (let i = 0; i < 6; i++) {
      await makeDue(id);
      await dispatchWebhooks(100);
    }
    for (const app of ["collaborate", "avasar"] as const) {
      const [r] = await rows(id, app);
      expect(r.status).toBe("failed");
      expect(r.outcome).toBe("delivery_failed");
      expect((await state(id, app))?.status).toBe("failed");
    }
  });
});

describe("the app's answer decides the status (an HTTP 200 alone is never 'synced')", () => {
  it("200 + ignored → missing (no profile there), and repair re-sends auto_provision which then creates it", async () => {
    const id = await user();
    await saveConsent(id, "collaborate", { scopes: { skills: true } as never, link: true });
    answers[`collaborate:${id}`] = [{ outcome: "ignored", action: "IGNORED_UNKNOWN_USER" }, { outcome: "created" }];
    await enqueueProfileUpdated(id, "profile_recomputed", "collaborate");
    await dispatchWebhooks(100);
    expect((await state(id, "collaborate"))?.status).toBe("missing");
    const [row] = await rows(id, "collaborate");
    expect(row).toMatchObject({ status: "delivered", outcome: "ignored" });
    const candidates = await findRepairCandidates("collaborate", 100, [id]);
    expect(candidates).toEqual([{ userId: id, cause: "missing" }]);
    const r = await repairMissingProfiles("collaborate", { apply: true, userIds: [id] });
    expect(r.queued).toBe(1);
    await dispatchWebhooks(100);
    expect(sent.at(-1)).toMatchObject({ userId: id, reason: "auto_provision" });
    expect((await state(id, "collaborate"))?.status).toBe("synced");
  });

  it("200 + conflict → conflict (owner can link) or review (admin), never retried, never synced", async () => {
    const a = await user();
    const b = await user();
    for (const id of [a, b]) await saveConsent(id, "collaborate", { scopes: { skills: true } as never, link: true });
    answers[`collaborate:${a}`] = [{ outcome: "conflict", action: "CONFLICT_EXISTING_ACCOUNT" }];
    answers[`collaborate:${b}`] = [{ outcome: "conflict", action: "CONFLICT_NEEDS_REVIEW" }];
    await enqueueProfileUpdated(a, "auto_provision", "collaborate");
    await enqueueProfileUpdated(b, "auto_provision", "collaborate");
    await dispatchWebhooks(100);
    expect((await state(a, "collaborate"))?.status).toBe("conflict");
    expect((await state(b, "collaborate"))?.status).toBe("review");
    expect((await rows(a, "collaborate"))[0]).toMatchObject({ status: "delivered", outcome: "conflict", attempts: 1 });
    // A routine update later does not hide the conflict.
    await enqueueProfileUpdated(a, "profile_recomputed", "collaborate");
    expect((await state(a, "collaborate"))?.status).toBe("conflict");
    // Repair leaves a fresh conflict alone (re-checked only after 7 days).
    expect(await findRepairCandidates("collaborate", 100, [b])).toEqual([]);
  });

  it("200 + ignored_consent → declined (the user deleted or disconnected the account in the app)", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true });
    answers[`avasar:${id}`] = [{ outcome: "ignored_consent", action: "ACCOUNT_DELETED_HERE" }];
    await enqueueProfileUpdated(id, "profile_recomputed", "avasar");
    await dispatchWebhooks(100);
    expect((await state(id, "avasar"))?.status).toBe("declined");
  });

  it("rejected / invalid_identity are permanent: failed at once, no retries", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true });
    answers[`avasar:${id}`] = [{ outcome: "rejected", action: "INVALID_PROJECTION" }];
    await enqueueProfileUpdated(id, "profile_recomputed", "avasar");
    await dispatchWebhooks(100);
    const [r] = await rows(id, "avasar");
    expect(r).toMatchObject({ status: "failed", outcome: "rejected", attempts: 1 });
    expect((await state(id, "avasar"))?.status).toBe("failed");
  });

  it("200 + retryable (receiver busy) is retried, not marked delivered", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true });
    answers[`avasar:${id}`] = [{ status: 200, outcome: "retryable", action: "DELIVERY_IN_PROGRESS" }, { outcome: "updated" }];
    await enqueueProfileUpdated(id, "manual_sync", "avasar");
    await dispatchWebhooks(100);
    expect((await rows(id, "avasar"))[0].status).toBe("pending");
    await makeDue(id);
    await dispatchWebhooks(100);
    expect((await state(id, "avasar"))?.status).toBe("synced");
  });

  it("an older receiver that answers 2xx with no outcome is delivered but shown as unconfirmed, not synced", async () => {
    const id = await user();
    await saveConsent(id, "collaborate", { scopes: { skills: true } as never, link: true });
    vi.stubGlobal("fetch", async () => new Response(null, { status: 200 }));
    await enqueueProfileUpdated(id, "manual_sync", "collaborate");
    await dispatchWebhooks(100);
    const s = await state(id, "collaborate");
    expect(s?.status).toBe("pending");
    expect(s?.lastOutcome).toBe("unconfirmed");
  });
});

describe("consent", () => {
  it("revoking stops future transfers, tells the app with the reason, and records the revocation", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true });
    await revokeLink(id, "avasar");
    await enqueueRevoked(id, "avasar");
    expect(await enqueueProfileUpdated(id, "profile_recomputed", "avasar")).toEqual([]);
    answers[`avasar:${id}`] = [{ outcome: "unlinked" }];
    await dispatchWebhooks(100);
    const revokeSent = sent.find((s) => s.userId === id && s.type === "integration.revoked");
    expect(revokeSent?.reason).toBe("user_disconnected");
    expect((await state(id, "avasar"))?.status).toBe("unlinked");
    const log = await db.select().from(schema.integrationConsentLog).where(and(eq(schema.integrationConsentLog.userId, id), eq(schema.integrationConsentLog.clientId, "avasar")));
    expect(log.map((l) => l.source)).toEqual(["user", "user_revoked"]);
  });

  it("consent revoked while an update was queued: the queued update is not sent", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true });
    await enqueueProfileUpdated(id, "profile_recomputed", "avasar");
    await revokeLink(id, "avasar");
    await dispatchWebhooks(100);
    expect(sent.filter((s) => s.userId === id && s.type === "profile.updated")).toEqual([]);
    expect((await rows(id, "avasar")).find((r) => r.event === "profile.updated")?.status).toBe("failed");
  });

  it("the consent log is insert-only (database trigger)", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true });
    await expect(db.update(schema.integrationConsentLog).set({ source: "user" }).where(eq(schema.integrationConsentLog.userId, id))).rejects.toThrow();
  });

  it("auto-provisioning never overrides an explicit choice, even one that shares nothing", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: {} as never });
    expect(await autoProvision(id, "avasar")).toBe(false);
    expect((await getConsent(id, "avasar"))!.linkedAt).toBeNull();
  });
});

describe("account deletion propagates", () => {
  it("each linked app hears integration.revoked with reason account_deleted; confirmed deletion shows as deleted", async () => {
    const id = await user();
    await autoProvisionNewUser(id);
    await dispatchWebhooks(100);
    expect(await enqueueRevokedForDeletion(id)).toEqual([]);
    answers[`avasar:${id}`] = ["network", { outcome: "deleted" }];
    answers[`collaborate:${id}`] = [{ outcome: "deleted" }];
    await dispatchWebhooks(100);
    expect((await state(id, "collaborate"))?.status).toBe("deleted");
    expect((await state(id, "avasar"))?.status).toBe("pending"); // the outage: retried
    await makeDue(id);
    await dispatchWebhooks(100);
    expect((await state(id, "avasar"))?.status).toBe("deleted");
    expect(sent.filter((s) => s.userId === id && s.type === "integration.revoked").every((s) => s.reason === "account_deleted")).toBe(true);
  });
});

describe("backfill of existing users", () => {
  it("Avsar backfill is off in the weekly job unless AVASAR_AUTO_PROVISION_BACKFILL=1", async () => {
    const id = await user();
    await provisionPendingUsers(1000);
    expect(await getConsent(id, "avasar")).toBeNull();
    expect(await getConsent(id, "collaborate")).not.toBeNull(); // Collaborate keeps its earlier behaviour
    process.env.AVASAR_AUTO_PROVISION_BACKFILL = "1";
    await provisionPendingUsers(1000);
    const c = await getConsent(id, "avasar");
    expect(c?.source).toBe("backfill");
    expect(c?.scopes.eris).toBe(false);
  });

  it("candidates exclude deleted accounts and anyone who already chose; re-running is a no-op", async () => {
    const fresh = await user();
    const deleted = await user({ deletedAt: new Date() });
    const chose = await user();
    await saveConsent(chose, "avasar", { scopes: {} as never });
    const pending = await pendingProvisionUsers("avasar", 10_000);
    expect(pending).toContain(fresh);
    expect(pending).not.toContain(deleted);
    expect(pending).not.toContain(chose);
    process.env.AVASAR_AUTO_PROVISION_BACKFILL = "1";
    await provisionPendingUsers(10_000);
    expect(await pendingProvisionUsers("avasar", 10_000)).not.toContain(fresh);
    const before = (await rows(fresh, "avasar")).length;
    await provisionPendingUsers(10_000);
    expect((await rows(fresh, "avasar")).length).toBe(before);
  });

  it("repair dry run changes nothing; apply queues once and is safe to re-run", async () => {
    const id = await user();
    await saveConsent(id, "avasar", { scopes: { skills: true } as never, link: true }); // linked, never sent (no status)
    const dry = await repairMissingProfiles("avasar", { userIds: [id] });
    expect(dry).toMatchObject({ dryRun: true, queued: 0, candidates: [{ userId: id, cause: "no_state" }] });
    expect(await rows(id, "avasar")).toHaveLength(0);
    expect((await repairMissingProfiles("avasar", { apply: true, userIds: [id] })).queued).toBe(1);
    expect((await repairMissingProfiles("avasar", { apply: true, userIds: [id] })).queued).toBe(0); // already queued
    expect(await rows(id, "avasar")).toHaveLength(1);
  });
});
