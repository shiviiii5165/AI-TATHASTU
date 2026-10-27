import { beforeAll, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ sessionUserId: null as string | null }));

vi.mock("@/auth", () => ({
  auth: async () => (state.sessionUserId ? { user: { id: state.sessionUserId } } : null),
}));

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

const { db } = await import("@/db");
const { jobs, onboardingState, profileViews, users } = await import("@/db/schema");
const { GET } = await import("./route");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const WAITING = id(1); // finished onboarding, intelligence job still queued
const READY = id(2); // has a computed view
const MID_ONBOARDING = id(3);

const get = (headers: Record<string, string> = {}) => GET(new Request("http://localhost/api/dashboard/status", { headers }));

beforeAll(async () => {
  await db.insert(users).values([
    { id: WAITING, name: "Waiting" },
    { id: READY, name: "Ready" },
    { id: MID_ONBOARDING, name: "Mid" },
  ]);
  await db.insert(onboardingState).values([
    { userId: WAITING, currentStep: "done" },
    { userId: READY, currentStep: "done" },
    { userId: MID_ONBOARDING, currentStep: "resume" },
  ]);
  await db.insert(profileViews).values({ userId: READY, view: { version: 1 } });
  await db.insert(jobs).values([
    { type: "compute_intelligence", userId: WAITING, idempotencyKey: "w1", status: "queued" },
    { type: "compute_intelligence", userId: READY, idempotencyKey: "r1", status: "done" },
  ]);
});

describe("GET /api/dashboard/status", () => {
  it("requires a session and a finished onboarding", async () => {
    state.sessionUserId = null;
    expect((await get()).status).toBe(401);
    state.sessionUserId = MID_ONBOARDING;
    expect((await get()).status).toBe(403);
  });

  it("reports only the signed-in user's own readiness and job", async () => {
    state.sessionUserId = WAITING;
    expect(await (await get()).json()).toEqual({ ready: false, job: "queued" });
    state.sessionUserId = READY;
    expect(await (await get()).json()).toEqual({ ready: true, job: "done" });
  });

  it("answers 304 with no body while nothing has changed", async () => {
    state.sessionUserId = WAITING;
    const first = await get();
    const etag = first.headers.get("ETag")!;
    const again = await get({ "If-None-Match": etag });
    expect(again.status).toBe(304);
    expect(await again.text()).toBe("");
  });
});
