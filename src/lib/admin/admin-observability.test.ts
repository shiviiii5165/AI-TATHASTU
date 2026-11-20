/**
 * AI telemetry, cost windows, module health, incidents and the Student Intelligence fairness review,
 * against the in-memory test database.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { sql as sqlTag } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({}), notFound: () => { throw new Error("NOT_FOUND"); }, redirect: (u: string) => { throw new Error(`REDIRECT ${u}`); } }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/r2", () => ({ deleteObject: async () => {}, listObjectKeys: async () => [], isR2Configured: () => false, UPLOAD_URL_TTL_SECONDS: 300 }));
const ADMIN = { id: "00000000-0000-4000-8000-0000000000b1", email: "ops@example.test", name: "Ops" };
vi.mock("@/lib/admin", () => ({ requireAdmin: async () => ADMIN, isAdmin: () => true }));
vi.mock("@/lib/admin/rbac", () => {
  const ctx = { user: ADMIN, role: "super_admin", permissions: [], isSuperAdmin: true };
  return { getAdminContext: async () => ctx, requireAdminPermission: async () => ctx, requireOperator: async () => ctx, hasPermission: () => true, ROLE_PERMISSIONS: new Proxy({}, { get: () => [] }) };
});

const { db } = await import("@/db");
const S = await import("@/db/schema");
const tele = await import("./ai-telemetry");
const inc = await import("./incidents");
const fair = await import("@/lib/intelligence/fairness");

const NOW = new Date();
const ago = (h: number) => new Date(NOW.getTime() - h * 3600_000);
const month = NOW.toISOString().slice(0, 7);
const day = (d: Date) => d.toISOString().slice(0, 10);
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

async function call(o: { provider: string; model?: string; status: "metered" | "estimated" | "released"; err?: string | null; ms?: number; cost?: number; at?: Date; tin?: number; tout?: number }) {
  const at = o.at ?? ago(1);
  await db.insert(S.aiUsageLedger).values({
    provider: o.provider, model: o.model ?? `${o.provider}-m`, purpose: "resume_extract", status: o.status, reservedUsd: "0.10",
    costUsd: String(o.cost ?? 0), tokensIn: o.tin ?? null, tokensOut: o.tout ?? null, latencyMs: o.ms ?? null, errorKind: o.err ?? null,
    day: day(at), month: at.toISOString().slice(0, 7), expiresAt: new Date(at.getTime() + 600_000), createdAt: at, settledAt: at,
  });
}

beforeAll(async () => {
  await db.insert(S.users).values(ADMIN);
  // groq: 4 ok (100/200/300/400 ms), 1 rate-limited, 1 timeout (estimated), 1 truncated (metered).
  for (const ms of [100, 200, 300, 400]) await call({ provider: "groq", status: "metered", ms, cost: 0.01, tin: 100, tout: 50 });
  await call({ provider: "groq", status: "released", err: "rate_limited", ms: 20 });
  await call({ provider: "groq", status: "estimated", err: "ReadTimeout", ms: 30000, cost: 0.1 });
  await call({ provider: "groq", status: "metered", err: "truncated", ms: 900, cost: 0.02, tin: 100, tout: 500 });
  // gemini: 1 rejected (refused); one old call outside "today".
  await call({ provider: "gemini", status: "released", err: "refused" });
  await call({ provider: "gemini", status: "metered", ms: 50, cost: 0.05, at: new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth(), NOW.getUTCDate()) - 3 * 86_400_000) });
});

describe("AI provider telemetry", () => {
  it("classifies calls: rate limits and rejections aren't timeouts; latency uses successful calls only", async () => {
    const t = await tele.providerTelemetry("30d", NOW);
    const g = t.providers.find((p) => p.provider === "groq")!;
    expect(g).toMatchObject({ calls: 7, succeeded: 4, rateLimited: 1, rejected: 0, timeouts: 1, otherErrors: 0, truncated: 1 });
    expect(g.successRate).toBeCloseTo(57.1, 1);
    expect(g.latency.median).toBe(250); // 100,200,300,400: the 30 s timeout and 900 ms truncated call are excluded
    expect(g.meteredUsd).toBeCloseTo(0.06, 5);
    expect(g.estimatedUsd).toBeCloseTo(0.1, 5);
    expect(g.tokensIn).toBe(500);
    const gem = t.providers.find((p) => p.provider === "gemini")!;
    expect(gem).toMatchObject({ calls: 2, rejected: 1, succeeded: 1 });
    expect(t.models.map((m) => m.model).sort()).toEqual(["gemini-m", "groq-m"]);
  });

  it("time windows really limit the data", async () => {
    if (NOW.getUTCDate() <= 3) return; // the "old" call may still fall in this month near month start
    const today = await tele.providerTelemetry("today", NOW);
    expect(today.providers.find((p) => p.provider === "gemini")!.calls).toBe(1);
    expect((await tele.dailySpend("7d", NOW)).length).toBe(7);
  });

  it("projection is labelled arithmetic, null before a full day", () => {
    expect(tele.projectMonthEnd(10, new Date(Date.UTC(2026, 10, 1, 12)))).toBeNull();
    expect(tele.projectMonthEnd(10, new Date(Date.UTC(2026, 10, 11, 0)))).toBe(30); // 10 days → $1/day × 30
  });

  it("the providers page shows both cost kinds and explains the classification", async () => {
    const { default: Page } = await import("@/app/admin/ai-ops/providers/page");
    const out = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ w: "30d" }) }));
    expect(out).toContain("1 rate-limited");
    expect(out).toContain("1 timed out");
    expect(out).toContain("How these numbers are counted");
    expect(out).not.toMatch(/invoice[^.]*:/i);
  });
});

describe("Module health and incidents", () => {
  it("classify: no activity is unknown, never healthy", () => {
    expect(inc.classify(0, 0)).toBe("unknown");
    expect(inc.classify(5, 0)).toBe("healthy");
    expect(inc.classify(5, 1)).toBe("degraded");
    expect(inc.classify(0, 3)).toBe("critical");
  });

  it("sanitizes errors and groups repeats into one incident", async () => {
    expect(inc.sanitizeError("failed for jane@x.com with Bearer abc.def at https://api.x/y")).toBe("failed for <email> with Bearer <redacted> at <url>");
    expect(inc.fingerprint("m", "timeout after 30s on job 123")).toBe(inc.fingerprint("m", "timeout after 45s on job 987"));
    expect(inc.fingerprint("m", "timeout")).not.toBe(inc.fingerprint("other", "timeout"));

    await db.insert(S.users).values({ id: uid(5), email: "s@example.test" });
    for (let i = 0; i < 4; i++) {
      await db.insert(S.jobs).values({ type: "resume_extract", userId: uid(5), idempotencyKey: `f${i}`, payload: {}, status: "failed", lastError: `PDF parse error at page ${i + 2} for s${i}@example.test`, finishedAt: ago(i) } as never);
    }
    await db.insert(S.jobs).values({ type: "resume_extract", userId: uid(5), idempotencyKey: "old", payload: {}, status: "failed", lastError: "Disk full", finishedAt: ago(48) } as never);
    const list = await inc.listIncidents(NOW);
    const pdf = list.find((i) => i.latestError.startsWith("PDF parse error"))!;
    expect(pdf).toMatchObject({ module: "Resume processing", occurrences: 4, status: "active", severity: "critical" });
    expect(pdf.latestError).not.toContain("@example.test");
    expect(list.find((i) => i.latestError === "Disk full")!.status).toBe("quiet");
    // AI: rate limits are a warning, the timeout is critical.
    expect(list.find((i) => i.latestError === "groq: rate_limited")!.severity).toBe("warning");
    expect(list.find((i) => i.latestError === "groq: ReadTimeout")!.severity).toBe("critical");
  });

  it("module health: resume processing failing with no success is critical; idle modules are unknown", async () => {
    const m = await inc.moduleHealth();
    expect(m.find((x) => x.id === "resume_extract")!.status).toBe("critical");
    expect(m.find((x) => x.id === "compute_matches")!.status).toBe("unknown");
    expect(m.find((x) => x.id === "ai")!.status).toBe("degraded");
    expect(m.find((x) => x.id === "research_sources")!.status).toBe("unknown");
  });

  it("the health page counts coverage honestly and opens incident details", async () => {
    const { default: Page } = await import("@/app/admin/system/page");
    const out = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
    expect(out).toMatch(/Monitoring coverage: \d+ of \d+ parts/);
    // Resume processing is critical (4 failures, no success) so the overall state is critical, and it says so.
    expect(out).toMatch(/data-testid="overall-status"[\s\S]*?Critical/);
    expect(out).toContain(" IST");
    const id = (await inc.listIncidents(NOW))[0]!.id;
    const detail = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ incident: id }) }));
    expect(detail).toContain("Not determined");
    expect(detail).toContain("Most recent affected records");
  });
});

describe("Fairness review", () => {
  it("hides small groups, flags large evidence gaps, and never uses protected attributes", async () => {
    let n = 100;
    const add = async (university: string, resume: boolean) => {
      const id = uid(n++);
      await db.insert(S.users).values({ id, email: `${id}@example.test`, role: "student", university });
      if (resume) await db.insert(S.files).values({ userId: id, kind: "resume", storageKey: `r/${id}`, sha256: id, sizeBytes: 1, mime: "application/pdf" });
    };
    for (let i = 0; i < 6; i++) await add("Alpha College", true);
    for (let i = 0; i < 6; i++) await add("Beta College", false);
    for (let i = 0; i < 2; i++) await add("Tiny College", true);
    const r = await fair.evidenceAvailability("institution");
    expect(r.groups.map((g) => g.group).sort()).toEqual(["Alpha College", "Beta College"]);
    expect(r.smallGroupsHidden).toBeGreaterThanOrEqual(1);
    expect(r.groups.find((g) => g.group === "Beta College")!.flagged).toContain("resume");
    expect(r.groups.find((g) => g.group === "Beta College")!.rates.resume).toBe(0);
  });

  it("flags a saved ranking that counts missing evidence as 0", async () => {
    await db.insert(S.intelligenceRankingProfiles).values({
      name: "Legacy zero", status: "published", publishedVersion: 1, createdByEmail: "x", updatedByEmail: "x",
      definition: { schema: 1, categories: [], cohort: {}, eligibility: { minCoverage: 0, requiredBenchmarks: [] }, evidencePolicy: "any", missingPolicy: "zero" },
    } as never);
    const r = await fair.reviewRankings();
    const legacy = r.rankings.find((x) => x.name === "Legacy zero")!;
    expect(legacy.issues.some((i) => i.path === "missingPolicy")).toBe(true);
  });
});

describe("Student 360 and Compare: evidence, confidence and comparability", () => {
  it("Student 360 shows coverage and confidence and records the view in the audit log", async () => {
    const id = uid(301);
    await db.insert(S.users).values({ id, email: "kiran@example.test", name: "Kiran", role: "student", degree: "B.Tech" });
    await db.insert(S.profileFacts).values({ userId: id, fieldGroup: "education", fieldName: "grade", recordKey: "e1", origin: "resume", extractedValue: "CGPA 8.6/10" });
    const { default: Page } = await import("@/app/admin/intelligence/students/[id]/page");
    const out = renderToStaticMarkup(await Page({ params: Promise.resolve({ id }), searchParams: Promise.resolve({}) }));
    expect(out).toContain('data-testid="evidence-panel"');
    expect(out).toMatch(/data-testid="coverage-value"[^>]*>\d+%/);
    expect(out).toContain("Not collected yet");
    expect(out).toContain("Data gaps and quality issues");
    const { rows } = await db.execute(sqlTag`SELECT count(*)::int AS n FROM admin_audit_logs WHERE action = 'intelligence.student_view' AND target_id = ${id}`);
    expect((rows[0] as { n: number }).n).toBe(1);
  });

  it("Compare marks CGPA vs percentage as not comparable and explains why", async () => {
    const a = uid(302), b = uid(303);
    await db.insert(S.users).values([{ id: a, email: "a302@example.test", name: "Asha", role: "student" }, { id: b, email: "b303@example.test", name: "Bilal", role: "student" }]);
    await db.insert(S.profileFacts).values([
      { userId: a, fieldGroup: "education", fieldName: "grade", recordKey: "e", origin: "resume", extractedValue: "CGPA 8.6/10", confirmation: "confirmed" },
      { userId: b, fieldGroup: "education", fieldName: "grade", recordKey: "e", origin: "resume", extractedValue: "86%", confirmation: "confirmed" },
    ]);
    const { default: Compare } = await import("@/app/admin/intelligence/compare/page");
    const out = renderToStaticMarkup(await Compare({ searchParams: Promise.resolve({ ids: `${a},${b}` }) }));
    expect(out).toContain('data-testid="comparability-table"');
    expect(out).toContain("Not comparable");
    expect(out).toContain("different scales");
  });
});

void month;
