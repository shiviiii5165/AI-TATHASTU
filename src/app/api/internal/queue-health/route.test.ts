import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ db: null as never }));
vi.mock("server-only", () => ({}));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  state.db = (await createTestDb()) as never;
  return { db: state.db };
});
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), connection: async () => {} }));

import { GET } from "./route";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => state.db as any;
const SECRET = "queue-health-test-secret-0123456789abcdef0123";
const call = (secret = SECRET) => GET(new Request("https://app.test/api/internal/queue-health", { headers: { authorization: `Bearer ${secret}` } }));

let user: string;
async function job(status: string, extra = "") {
  const key = randomUUID();
  await db().execute(sql.raw(`INSERT INTO jobs (type, user_id, idempotency_key, status ${extra ? ", " + extra.split("=")[0] : ""})
    VALUES ('resume_extract', '${user}', '${key}', '${status}' ${extra ? ", " + extra.split("=")[1] : ""})`));
}

beforeEach(async () => {
  vi.stubEnv("INTERNAL_API_SECRET", SECRET);
  await db().execute(sql`DELETE FROM jobs`);
  user = randomUUID();
  await db().execute(sql.raw(`INSERT INTO users (id, email) VALUES ('${user}', '${user}@x.test')`));
});

describe("GET /api/internal/queue-health", () => {
  it("rejects callers without the secret", async () => {
    expect((await call("wrong")).status).toBe(401);
  });

  it("is healthy with fresh work", async () => {
    await job("queued");
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ queued: 1, alerts: [] });
  });

  it("alerts on an old queue", async () => {
    await job("queued", "run_at=now() - interval '20 minutes'");
    const res = await call();
    expect(res.status).toBe(503);
    expect((await res.json()).alerts).toEqual(["queue_age"]);
  });

  it("alerts on a job whose lock expired and that nothing reclaimed", async () => {
    await job("running", "locked_until=now() - interval '10 minutes'");
    expect((await (await call()).json()).alerts).toEqual(["stuck_jobs"]);
  });

  it("does not count a job scheduled for later as waiting", async () => {
    await job("queued", "run_at=now() + interval '1 hour'");
    const body = await (await call()).json();
    expect(body).toMatchObject({ queued: 0, oldest_queued_seconds: 0, alerts: [] });
  });
});
