import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const { connections, jobs, sessions, users } = await import("@/db/schema");
const { executeStudentDeletionWorkflow } = await import("./students");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const GONE = id(1);
const KEPT = id(2);

beforeAll(async () => {
  await db.insert(users).values([
    { id: GONE, name: "Leaving", email: "leaving@example.com" },
    { id: KEPT, name: "Staying", email: "staying@example.com" },
  ]);
  for (const userId of [GONE, KEPT]) {
    await db.insert(connections).values({ userId, sourceId: "github", accessMethod: "oauth", tokenEnc: Buffer.from("sealed"), status: "connected" });
    await db.insert(sessions).values({ sessionToken: `s-${userId}`, userId, expires: new Date(Date.now() + 3600_000) });
    await db.insert(jobs).values([
      { type: "resume_extract", userId, idempotencyKey: `queued-${userId}`, payload: {} },
      { type: "resume_extract", userId, idempotencyKey: `done-${userId}`, payload: {}, status: "done" },
    ]);
  }
});

describe("executeStudentDeletionWorkflow", () => {
  it("removes credentials and sessions and cancels queued work for that user only", async () => {
    await executeStudentDeletionWorkflow(GONE, "admin@example.com", "requested by the user");

    const [gone] = await db.select().from(users).where(eq(users.id, GONE));
    expect(gone.deletedAt).toBeInstanceOf(Date);
    expect(await db.select().from(connections).where(eq(connections.userId, GONE))).toEqual([]);
    expect(await db.select().from(sessions).where(eq(sessions.userId, GONE))).toEqual([]);

    const goneJobs = await db.select().from(jobs).where(eq(jobs.userId, GONE));
    expect(goneJobs.find((j) => j.idempotencyKey === `queued-${GONE}`)).toMatchObject({ status: "failed", lastError: "Account deleted" });
    expect(goneJobs.find((j) => j.idempotencyKey === `done-${GONE}`)?.status).toBe("done");

    const [kept] = await db.select().from(users).where(eq(users.id, KEPT));
    expect(kept.deletedAt).toBeNull();
    expect(await db.select().from(connections).where(eq(connections.userId, KEPT))).toHaveLength(1);
    expect(await db.select().from(sessions).where(eq(sessions.userId, KEPT))).toHaveLength(1);
    const keptJobs = await db.select().from(jobs).where(eq(jobs.userId, KEPT));
    expect(keptJobs.find((j) => j.idempotencyKey === `queued-${KEPT}`)?.status).toBe("queued");
  });
});
