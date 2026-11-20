import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

// As on Vercel, where the platform supplies the client IP (off-Vercel all clients share one bucket).
vi.stubEnv("VERCEL", "1");

const { db } = await import("@/db");
const { POST } = await import("./route");

const report = (body: unknown, ip = "10.1.0.1") =>
  POST(new Request("http://localhost:3000/api/client-errors", { method: "POST", headers: { "Content-Type": "application/json", "x-forwarded-for": ip }, body: JSON.stringify(body) }));
const routes = async () => ((await db.execute(sql`select route from route_stats where route like 'client %'`)).rows as { route: string }[]).map((r) => r.route);

describe("POST /api/client-errors", () => {
  it("stores the path and error class only, never a message", async () => {
    const res = await report({ path: "/dashboard?q=secret", kind: "TypeError", digest: "abc123", message: "user@example.com leaked" }, "10.1.0.2");
    expect(res.status).toBe(200);
    const rows = (await db.execute(sql`select route, last_error from route_stats where route like 'client %'`)).rows;
    expect(JSON.stringify(rows)).not.toContain("secret");
    expect(JSON.stringify(rows)).not.toContain("user@example.com");
    expect(rows).toContainEqual({ route: "client GET /dashboard", last_error: "TypeError (digest abc123)" });
  });

  it("rejects paths that aren't app paths", async () => {
    expect((await report({ path: "https://evil.example/x" }, "10.1.0.3")).status).toBe(400);
  });

  it("rate-limits each client so the table can't be flooded with invented paths", async () => {
    const before = (await routes()).length;
    const statuses: number[] = [];
    for (let i = 0; i < 15; i++) statuses.push((await report({ path: `/flood-${i}` }, "10.1.0.9")).status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(10);
    expect(statuses.slice(10).every((s) => s === 429)).toBe(true);
    expect((await routes()).length - before).toBe(10);
    // Another client is unaffected.
    expect((await report({ path: "/other" }, "10.1.0.10")).status).toBe(200);
  });
});
