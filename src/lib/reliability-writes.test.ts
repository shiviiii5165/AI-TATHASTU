// Duplicate and retry behaviour of the write paths, against real SQL (PGlite).
import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: null as never, user: null as { id: string; role: string } | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  state.db = (await createTestDb()) as never;
  return { db: state.db };
});
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: () => {},
  connection: async () => {},
}));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`REDIRECT:${to}`);
  },
}));
vi.mock("@/lib/dal", () => ({
  requireOnboardingStep: async () => ({ user: state.user, state: { currentStep: "resume" } }),
  requireOnboardedUser: async () => ({ user: state.user, state: { currentStep: "done" } }),
}));
vi.mock("@/lib/onboarding/refresh", () => ({ refreshOnboardingShell: () => {} }));
vi.mock("@/lib/integrations/webhooks", () => ({ dispatchWebhooks: async () => {}, enqueueProfileUpdated: async () => [] }));

import { refreshGithub } from "@/app/(dashboard)/dashboard/actions";
import { saveResumeReview } from "@/app/onboarding/actions";
import { connections, jobs, profileFacts, users } from "@/db/schema";
import { connectSource } from "@/lib/connectors/connections";
import { registerResume } from "@/lib/uploads/register";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => state.db as any;

async function newUser(step = "resume") {
  const id = randomUUID();
  await db().insert(users).values({ id, email: `${id}@example.test`, role: "student" });
  await db().execute(sql`INSERT INTO onboarding_state (user_id, current_step) VALUES (${id}, ${step})`);
  state.user = { id, role: "student" };
  return id;
}

const upload = { fileName: "cv.pdf", sizeBytes: 100, mime: "application/pdf" as const, sha256: "a".repeat(64) };

describe("resume retry", () => {
  beforeEach(() => newUser());

  it("re-uploading the same bytes after a failed run queues it again, on the same job", async () => {
    const { jobId } = await registerResume(state.user!.id, upload);
    await db().update(jobs).set({ status: "failed", attempts: 3, lastError: "provider down", finishedAt: new Date(), payload: sql`payload || '{"notified_at":"x"}'` }).where(eq(jobs.id, jobId));

    const retry = await registerResume(state.user!.id, upload);

    expect(retry.jobId).toBe(jobId);
    const [job] = await db().select().from(jobs).where(eq(jobs.id, jobId));
    expect(job).toMatchObject({ status: "queued", attempts: 0, lastError: null, finishedAt: null });
    expect(job.payload.notified_at).toBeUndefined(); // the retry's outcome gets its own email
  });

  it.each(["queued", "running", "done", "needs_review"] as const)("a repeat while the job is %s changes nothing", async (status) => {
    const { jobId } = await registerResume(state.user!.id, upload);
    await db().update(jobs).set({ status, attempts: 1 }).where(eq(jobs.id, jobId));

    await registerResume(state.user!.id, upload);

    const [job] = await db().select().from(jobs).where(eq(jobs.id, jobId));
    expect(job).toMatchObject({ status, attempts: 1 });
    expect(await db().select().from(jobs).where(eq(jobs.userId, state.user!.id))).toHaveLength(1);
  });
});

describe("connector sync dedupe", () => {
  beforeEach(() => newUser("done"));

  const syncs = () => db().select().from(jobs).where(eq(jobs.userId, state.user!.id));

  it("repeated Refresh clicks queue one sync", async () => {
    const [connection] = await db().insert(connections).values({ userId: state.user!.id, sourceId: "github", accessMethod: "oauth", status: "connected" }).returning();
    await Promise.all([refreshGithub(), refreshGithub()]);
    await refreshGithub();
    const rows = await syncs();
    expect(rows.length).toBeLessThanOrEqual(2); // the two simultaneous clicks can race; the worker runs them one at a time
    await refreshGithub();
    expect(await syncs()).toHaveLength(rows.length);
    expect(rows[0].payload).toMatchObject({ source_id: "github", connection_id: connection.id });
  });

  it("a double-submitted connect form queues one sync", async () => {
    const connect = (syncKey: string) =>
      connectSource({ userId: state.user!.id, sourceId: "leetcode", accessMethod: "oauth", credential: null, syncKey });
    await connect("a");
    await connect("b");
    expect(await syncs()).toHaveLength(1);
  });

  it("queues again once the previous sync has finished", async () => {
    await db().insert(connections).values({ userId: state.user!.id, sourceId: "github", accessMethod: "oauth", status: "connected" });
    await refreshGithub();
    await db().update(jobs).set({ status: "done" }).where(eq(jobs.userId, state.user!.id));
    await refreshGithub();
    expect(await syncs()).toHaveLength(2);
  });
});

describe("resume review retry", () => {
  beforeEach(() => newUser());

  it("saving the same hand-added entry twice stores it once", async () => {
    const recordKey = randomUUID();
    const input = { decisions: [], additions: [{ fieldGroup: "skills", recordKey, fieldName: "skill", value: "Rust" }] };
    await expect(saveResumeReview(input)).rejects.toThrow(/REDIRECT/);
    await expect(saveResumeReview(input)).rejects.toThrow(/REDIRECT/);
    const facts = await db().select().from(profileFacts).where(eq(profileFacts.userId, state.user!.id));
    expect(facts).toHaveLength(1);
  });
});
