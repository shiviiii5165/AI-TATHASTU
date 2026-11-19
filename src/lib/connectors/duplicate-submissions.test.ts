/**
 * Duplicate profile-link submissions: canonical identities, keyed fingerprints, and connectWithForm
 * not re-queuing paid syncs for the same resource. Real action on PGlite; sign-in mocked.
 */
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: () => {} }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/auth", () => ({ auth: async () => null, signIn: async () => {}, signOut: async () => {}, unstable_update: async () => {} }));
const current = vi.hoisted(() => ({ user: { id: "", role: "student", email: "x@example.com" } }));
vi.mock("@/lib/dal", () => {
  const state = { currentStep: "done" };
  const page = async () => ({ user: current.user, state });
  return { requireConnectorUser: page, requireOnboardedUser: page, getCurrentUser: async () => current.user };
});

process.env.CONNECTOR_TOKEN_KEY = Buffer.alloc(32, 7).toString("base64");
process.env.AUTH_SECRET = "test-auth-secret-0123456789abcdef0123456789";

const { db } = await import("@/db");
const { connections, jobs, onboardingState, users } = await import("@/db/schema");
const { canonicalPublicUrl, credentialIdentity, identityFingerprint } = await import("@/lib/connectors/canonical");
const { connectWithForm } = await import("@/app/(dashboard)/connections/actions");

let next = 1;
async function newStudent() {
  const id = `00000000-0000-4000-9000-${String(next++).padStart(12, "0")}`;
  await db.insert(users).values({ id, email: `${id}@example.com` });
  await db.insert(onboardingState).values({ userId: id, currentStep: "done" });
  current.user = { id, role: "student", email: `${id}@example.com` };
  return id;
}
const syncJobs = (userId: string) => db.select().from(jobs).where(and(eq(jobs.userId, userId), eq(jobs.type, "connector_sync")));
// A sync still queued already covers any update (it reads the latest credential when it runs), so
// the cases below that expect a NEW job first let the earlier sync finish, as it would in production.
const finishSyncs = (userId: string) => db.update(jobs).set({ status: "done" }).where(eq(jobs.userId, userId));

beforeEach(async () => {
  await newStudent();
});

describe("canonicalPublicUrl", () => {
  it("treats case, trailing slash, fragment and tracking parameters as the same page", () => {
    const base = canonicalPublicUrl("https://anant.dev/projects");
    for (const variant of [
      "HTTPS://Anant.DEV/projects/",
      "https://anant.dev/projects#top",
      "https://anant.dev/projects?utm_source=linkedin&utm_campaign=x",
      "https://anant.dev:443/projects?fbclid=abc&gclid=def",
    ]) expect(canonicalPublicUrl(variant)).toBe(base);
  });

  it("keeps what can select a different page: path, path case, meaningful query", () => {
    expect(canonicalPublicUrl("https://anant.dev/projects")).not.toBe(canonicalPublicUrl("https://anant.dev/blog"));
    expect(canonicalPublicUrl("https://site.dev/Anant")).not.toBe(canonicalPublicUrl("https://site.dev/anant"));
    expect(canonicalPublicUrl("https://site.dev/p?id=2&utm_source=x")).toBe("https://site.dev/p?id=2");
    expect(canonicalPublicUrl("https://site.dev/p?id=2")).not.toBe(canonicalPublicUrl("https://site.dev/p?id=3"));
  });
});

describe("credentialIdentity", () => {
  it("is per source and ignores formatting", () => {
    expect(credentialIdentity("leetcode", { username: "SomeOne" })).toBe(credentialIdentity("leetcode", { username: "someone" }));
    expect(credentialIdentity("stack_exchange", { site: "StackOverflow", userId: 42 })).toBe("stackoverflow:42");
    expect(credentialIdentity("portfolio", { url: "https://Me.dev/?utm_medium=x" })).toBe(credentialIdentity("portfolio", { url: "https://me.dev" }));
  });

  it("a new Kaggle key for the same username is a real update", () => {
    expect(credentialIdentity("kaggle", { username: "anant", key: "a".repeat(32) })).not.toBe(credentialIdentity("kaggle", { username: "anant", key: "b".repeat(32) }));
  });
});

describe("identityFingerprint", () => {
  it("is stable, keyed by the server secret, and not a bare SHA-256 of the value", async () => {
    const { createHash } = await import("node:crypto");
    const a = identityFingerprint("someone");
    expect(identityFingerprint("someone")).toBe(a);
    expect(a).not.toBe(createHash("sha256").update("someone").digest("hex").slice(0, 32));
    const saved = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "another-secret-entirely-0123456789abcdef";
    expect(identityFingerprint("someone")).not.toBe(a);
    process.env.AUTH_SECRET = saved;
  });
});

describe("connectWithForm duplicate handling", () => {
  it("the same handle again (URL form, different case, tracking params) queues no second paid sync", async () => {
    const me = current.user.id;
    expect(await connectWithForm("leetcode", { username: "someone" })).toEqual({ ok: true });
    expect(await connectWithForm("leetcode", { username: "https://leetcode.com/u/SomeOne/?utm_source=share" })).toEqual({ ok: true });
    expect(await connectWithForm("leetcode", { username: "SOMEONE" })).toEqual({ ok: true });
    expect(await syncJobs(me)).toHaveLength(1);
    expect(await db.select().from(connections).where(eq(connections.userId, me))).toHaveLength(1);
  });

  it("a different handle is a legitimate update and syncs", async () => {
    const me = current.user.id;
    await connectWithForm("leetcode", { username: "someone" });
    await finishSyncs(me);
    await connectWithForm("leetcode", { username: "someone-else" });
    expect(await syncJobs(me)).toHaveLength(2);
  });

  it("resubmitting after a failed sync retries it", async () => {
    const me = current.user.id;
    await connectWithForm("leetcode", { username: "someone" });
    await db.update(jobs).set({ status: "failed" }).where(eq(jobs.userId, me));
    await db.update(connections).set({ status: "failed" }).where(eq(connections.userId, me));
    await connectWithForm("leetcode", { username: "someone" });
    expect(await syncJobs(me)).toHaveLength(2);
  });

  it("different students submitting the same public handle are both accepted", async () => {
    const first = current.user.id;
    await connectWithForm("leetcode", { username: "shared-handle" });
    const second = await newStudent();
    await connectWithForm("leetcode", { username: "shared-handle" });
    expect(await syncJobs(first)).toHaveLength(1);
    expect(await syncJobs(second)).toHaveLength(1);
  });

  it("concurrent identical submissions converge on one connection and one sync job", async () => {
    const me = current.user.id;
    await Promise.all([
      connectWithForm("stack_exchange", { profileUrl: "https://stackoverflow.com/users/42/me" }),
      connectWithForm("stack_exchange", { profileUrl: "https://stackoverflow.com/users/42/me?tab=profile" }),
      connectWithForm("stack_exchange", { profileUrl: "https://www.stackoverflow.com/users/42" }),
    ]);
    expect(await db.select().from(connections).where(eq(connections.userId, me))).toHaveLength(1);
    expect(await syncJobs(me)).toHaveLength(1);
  });

  it("a new Kaggle key re-syncs; the same key doesn't", async () => {
    const me = current.user.id;
    await connectWithForm("kaggle", { username: "anant", key: "a".repeat(32) });
    await finishSyncs(me);
    await connectWithForm("kaggle", { username: "anant", key: "a".repeat(32) });
    expect(await syncJobs(me)).toHaveLength(1);
    await connectWithForm("kaggle", { username: "anant", key: "b".repeat(32) });
    expect(await syncJobs(me)).toHaveLength(2);
  });
});
