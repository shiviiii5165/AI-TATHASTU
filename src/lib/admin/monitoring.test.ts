/**
 * Durable monitoring (migration 0033): route outcomes, worker heartbeats, health-check history and the incident
 * lifecycle, against the in-memory test database (all migrations applied).
 */
import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { db } = await import("@/db");
const S = await import("@/db/schema");
const m = await import("./monitoring");
const { guarded } = await import("@/lib/api-guard");

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("route outcomes", () => {
  it("guarded routes record ok, failed (500 and thrown) and slow counts per normalized route", async () => {
    const ok = guarded(async (_r: Request) => new Response("ok"));
    const bad = guarded(async (_r: Request) => new Response("x", { status: 502 }));
    const boom = guarded(async (_r: Request): Promise<Response> => { throw new TypeError("secret detail must not be stored"); });
    const id = "11111111-2222-4333-8444-555555555555";
    await ok(new Request(`http://t/api/things/${id}`));
    await ok(new Request(`http://t/api/things/${id}`));
    await bad(new Request("http://t/api/things/42"));
    await boom(new Request("http://t/api/things/43"));
    await flush();
    const r = await m.routeHealth();
    expect(r.available).toBe(true);
    const things = r.routes.find((x) => x.route === "GET /api/things/:id")!;
    expect(things).toMatchObject({ requests: 2, failed: 0, status: "healthy" });
    const n = r.routes.find((x) => x.route === "GET /api/things/:n")!;
    expect(n).toMatchObject({ requests: 2, failed: 2, status: "degraded" });
    expect(n.lastError).toBe("TypeError"); // class only, never the message
    expect(JSON.stringify(r)).not.toContain("secret detail");
  });

  it("a route at or above 20% failures with 5+ requests is critical", async () => {
    for (let i = 0; i < 4; i++) await m.recordRouteOutcome({ route: "POST /api/x", ok: true, ms: 10, slow: false });
    await m.recordRouteOutcome({ route: "POST /api/x", ok: false, ms: 10, slow: false, error: "HTTP 500" });
    expect((await m.routeHealth()).routes.find((x) => x.route === "POST /api/x")!.status).toBe("critical");
  });
});

describe("worker heartbeat", () => {
  const now = Date.parse("2026-11-20T10:00:00Z");
  const beat = (o: Partial<import("./worker-health").WorkerBeat>) => ({ workerId: "w", state: "polling", version: null, lastBeat: "2026-11-20T09:59:00Z", expectedBy: null, activeJobs: 0, lastJobDoneAt: null, lastJobFailedAt: null, ...o });
  it("no heartbeat is unknown; a fresh one healthy; a silent awake worker critical; a sleeping one healthy until its wake time + grace", () => {
    expect(m.workerStatus([], now).status).toBe("unknown");
    expect(m.workerStatus([beat({})], now).status).toBe("healthy");
    expect(m.workerStatus([beat({ lastBeat: "2026-11-20T09:50:00Z" })], now).status).toBe("critical");
    expect(m.workerStatus([beat({ state: "sleeping", lastBeat: "2026-11-20T09:00:00Z", expectedBy: "2026-11-20T10:20:00Z" })], now).status).toBe("healthy");
    expect(m.workerStatus([beat({ state: "sleeping", lastBeat: "2026-11-20T08:00:00Z", expectedBy: "2026-11-20T09:30:00Z" })], now).status).toBe("critical");
  });

  it("reads beats written in the worker's format", async () => {
    await db.execute(sql`INSERT INTO worker_heartbeats (worker_id, state, last_beat) VALUES ('host:1:abcd', 'polling', now())`);
    const { available, beats } = await m.workerBeats();
    expect(available).toBe(true);
    expect(m.workerStatus(beats).status).toBe("healthy");
  });
});

describe("health history and incident lifecycle", () => {
  it("a health run stores every check and creates incidents; resolving needs a note and doesn't change health", async () => {
    await db.insert(S.users).values({ id: "00000000-0000-4000-8000-0000000000c1", email: "u@example.test" });
    await db.insert(S.jobs).values({ type: "resume_extract", userId: "00000000-0000-4000-8000-0000000000c1", idempotencyKey: "m1", payload: {}, status: "failed", lastError: "PDF has no text layer", finishedAt: new Date() } as never);
    const run = await m.runAndRecordHealth();
    expect(run.recorded).toBe(true);
    const h = await m.checkHistory();
    expect(h.rows.map((r) => r.component)).toContain("database");
    const { incidents } = await m.storedIncidents();
    const inc = incidents.find((i) => i.latestError.startsWith("PDF"))!;
    expect(inc.state).toBe("new");

    expect(await m.setIncidentState(inc.fingerprint, "resolved", "ops@x")).toMatchObject({ ok: false, error: "Add a resolution note." });
    expect(await m.setIncidentState(inc.fingerprint, "reopened", "ops@x")).toMatchObject({ ok: false });
    expect(await m.setIncidentState(inc.fingerprint, "acknowledged", "ops@x")).toMatchObject({ ok: true, from: "new" });
    expect(await m.setIncidentState(inc.fingerprint, "resolved", "ops@x", "Re-ran OCR")).toMatchObject({ ok: true });

    // Still failing after resolution → reopened by the next run.
    await db.insert(S.jobs).values({ type: "resume_extract", userId: "00000000-0000-4000-8000-0000000000c1", idempotencyKey: "m2", payload: {}, status: "failed", lastError: "PDF has no text layer", finishedAt: new Date(Date.now() + 1000) } as never);
    await m.syncIncidents(new Date(Date.now() + 2000));
    const after = (await m.storedIncidents()).incidents.find((i) => i.fingerprint === inc.fingerprint)!;
    expect(after.state).toBe("reopened");
  });

  it("transition rules", () => {
    expect(m.canMove("new", "resolved")).toBe(true);
    expect(m.canMove("resolved", "acknowledged")).toBe(false);
    expect(m.canMove("resolved", "reopened")).toBe(true);
  });
});
