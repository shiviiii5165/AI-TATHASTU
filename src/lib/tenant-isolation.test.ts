import { and, eq, inArray } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

// The BOLA matrix in docs/security/phase-1-route-query-audit.md: user A acting on, or asking for, user B's objects.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: () => {} }));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

const { db } = await import("@/db");
const { connections, consents, jobs, profileFacts, users, widgetPrefs } = await import("@/db/schema");
const { getJobForUser, getLatestResumeJob } = await import("@/lib/dal");
const { disconnectSource } = await import("@/lib/connectors/connections");
const { appendConsent, getCurrentConsents } = await import("@/lib/consent/store");
const { getWidgetPrefs, setWidgetPref } = await import("@/lib/dashboard/prefs");
const { resumeStorageKey } = await import("@/lib/uploads/resume");

const ALICE = "00000000-0000-4000-8000-00000000000a";
const BOB = "00000000-0000-4000-8000-00000000000b";
const BOB_JOB = "00000000-0000-4000-8000-0000000000b1";

beforeAll(async () => {
  await db.insert(users).values([
    { id: ALICE, email: "alice@example.com" },
    { id: BOB, email: "bob@example.com" },
  ]);
  await db.insert(jobs).values({ id: BOB_JOB, type: "resume_extract", userId: BOB, idempotencyKey: "bob-job", payload: { fileName: "bob.pdf" } });
  for (const userId of [ALICE, BOB]) {
    await db.insert(connections).values({ userId, sourceId: "kaggle", accessMethod: "api_key", status: "connected" });
    await db.insert(profileFacts).values({
      userId, fieldGroup: "skills", fieldName: "skill", extractedValue: "Rust", extractionMethod: "api:kaggle", origin: "kaggle", confidence: 1, validationStatus: "validated", confirmation: "unconfirmed",
    });
  }
});

describe("jobs", () => {
  it("reads another user's job id as not found", async () => {
    expect(await getJobForUser(ALICE, BOB_JOB)).toBeNull();
    expect(await getLatestResumeJob(ALICE)).toBeNull();
  });

  it("returns it to its owner", async () => {
    expect((await getJobForUser(BOB, BOB_JOB))?.fileName).toBe("bob.pdf");
  });
});

describe("connections", () => {
  it("disconnecting removes only the caller's connection and facts", async () => {
    await disconnectSource(ALICE, "kaggle");
    expect(await db.select().from(connections).where(eq(connections.userId, ALICE))).toEqual([]);
    expect(await db.select().from(profileFacts).where(eq(profileFacts.userId, ALICE))).toEqual([]);
    expect(await db.select().from(connections).where(eq(connections.userId, BOB))).toHaveLength(1);
    expect(await db.select().from(profileFacts).where(eq(profileFacts.userId, BOB))).toHaveLength(1);
  });
});

describe("consents", () => {
  it("are written and read per user", async () => {
    await appendConsent(ALICE, "analytics", true);
    expect((await getCurrentConsents(ALICE)).analytics?.granted).toBe(true);
    expect((await getCurrentConsents(BOB)).analytics).toBeUndefined();
    expect(await db.select().from(consents).where(and(eq(consents.userId, BOB), inArray(consents.purpose, ["analytics"])))).toEqual([]);
  });
});

describe("widget preferences", () => {
  it("are written and read per user", async () => {
    await setWidgetPref(ALICE, { widgetId: "skill_gaps", pinned: true });
    expect((await getWidgetPrefs(ALICE)).map((p) => p.widgetId)).toEqual(["skill_gaps"]);
    expect(await getWidgetPrefs(BOB)).toEqual([]);
    expect(await db.select().from(widgetPrefs).where(eq(widgetPrefs.userId, BOB))).toEqual([]);
  });
});

describe("resume storage keys", () => {
  it("are derived from the user, so the same bytes never share an object across users", () => {
    const sha = "a".repeat(64);
    expect(resumeStorageKey(ALICE, sha, "application/pdf")).not.toBe(resumeStorageKey(BOB, sha, "application/pdf"));
    expect(resumeStorageKey(ALICE, sha, "application/pdf").startsWith(`resumes/${ALICE}/`)).toBe(true);
  });
});
