/**
 * Admin upgrade: Overview aggregates, Student Directory filters/pagination, account detail, permission-gated
 * Student 360 links, and read-only rendering.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { sql } from "drizzle-orm";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ push() {}, refresh() {} }), notFound: () => { throw new Error("NOT_FOUND"); }, redirect: () => { throw new Error("REDIRECT"); } }));
vi.mock("@/auth", () => ({ auth: async () => null }));
vi.mock("@/lib/r2", () => ({ deleteObject: async () => {}, listObjectKeys: async () => [], isR2Configured: () => false, UPLOAD_URL_TTL_SECONDS: 300 }));

const ADMIN = { id: "00000000-0000-4000-8000-0000000000aa", email: "ops@example.test", name: "Ops" };
const perms = vi.hoisted(() => ({ superAdmin: true, list: [] as string[] }));
vi.mock("@/lib/admin", () => ({ requireAdmin: async () => ADMIN, isAdmin: () => true }));
vi.mock("@/lib/admin/rbac", () => {
  const ctx = () => ({ user: ADMIN, role: perms.superAdmin ? "super_admin" : "support_agent", permissions: perms.list, isSuperAdmin: perms.superAdmin });
  return {
    getAdminContext: async () => ctx(),
    requireAdminPermission: async () => ctx(),
    requireOperator: async () => ctx(),
    hasPermission: (c: { isSuperAdmin: boolean; permissions: string[] }, p: string) => c.isSuperAdmin || c.permissions.includes(p),
    ROLE_PERMISSIONS: new Proxy({}, { get: () => [] }),
  };
});

const { db } = await import("@/db");
const { connections, files, institutions, jobs, onboardingState, supportTickets, users } = await import("@/db/schema");
const overview = await import("./overview");
const { listStudents, listStudentFacets } = await import("./students");

const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const count = async (table: string) => Number(((await db.execute(sql.raw(`SELECT count(*)::int AS n FROM ${table}`))).rows[0] as { n: number }).n);
const NOW = new Date();
const monthsAgo = (m: number) => new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - m, 10));

beforeAll(async () => {
  await db.insert(users).values(ADMIN);
  // 30 students, 3 faculty, 2 alumni, 1 deleted student (excluded everywhere).
  for (let i = 1; i <= 36; i++) {
    const role = i <= 30 ? "student" : i <= 33 ? "faculty" : i <= 35 ? "alumni" : "student";
    await db.insert(users).values({
      id: uid(i),
      email: `u${String(i).padStart(2, "0")}@example.test`,
      name: `Person ${String(i).padStart(2, "0")}`,
      role: role as never,
      degree: i % 2 ? "B.Tech" : "M.Sc",
      academicYear: i % 3 ? "2nd year" : "4th year",
      graduationYear: i % 2 ? 2027 : 2026,
      university: i <= 10 ? "IIT Hyderabad" : "Other College",
      createdAt: i <= 4 ? monthsAgo(2) : NOW,
      deletedAt: i === 36 ? NOW : null,
    });
  }
  // Onboarding finished for 12 (one of them last month); a row without completion for 5 more.
  for (let i = 1; i <= 12; i++) await db.insert(onboardingState).values({ userId: uid(i), currentStep: "done" as never, completedAt: i === 1 ? monthsAgo(1) : NOW });
  for (let i = 13; i <= 17; i++) await db.insert(onboardingState).values({ userId: uid(i), currentStep: "profile" as never });
  // Resumes for 7 users (one with two uploads), connections for 4 users.
  for (let i = 1; i <= 7; i++) await db.insert(files).values({ userId: uid(i), kind: "resume", storageKey: `resumes/${i}.pdf`, sha256: `h${i}`, sizeBytes: 2048, mime: "application/pdf" });
  await db.insert(files).values({ userId: uid(1), kind: "resume", storageKey: "resumes/1b.pdf", sha256: "h1b", sizeBytes: 4096, mime: "application/pdf" });
  await db.insert(files).values({ userId: uid(36), kind: "resume", storageKey: "resumes/36.pdf", sha256: "h36", sizeBytes: 1, mime: "application/pdf" }); // deleted user: excluded
  for (const [i, src] of [[1, "github"], [2, "github"], [3, "linkedin"], [3, "github"], [4, "kaggle"]] as const)
    await db.insert(connections).values({ userId: uid(i), sourceId: src, accessMethod: "oauth", status: "connected" } as never);
  // Action items.
  await db.insert(supportTickets).values([
    { ticketNumber: "A-1", requesterEmail: "a@x.test", subject: "a", status: "open", priority: "urgent", resolutionDueAt: new Date(Date.now() - 3600_000) },
    { ticketNumber: "A-2", requesterEmail: "b@x.test", subject: "b", status: "new", priority: "low" },
    { ticketNumber: "A-3", requesterEmail: "c@x.test", subject: "c", status: "closed", priority: "urgent" },
  ] as never);
  await db.insert(jobs).values([
    { type: "resume_extract", userId: uid(1), idempotencyKey: "f1", payload: {}, status: "failed", finishedAt: new Date() },
    { type: "resume_extract", userId: uid(2), idempotencyKey: "q1", payload: {}, status: "queued", runAt: new Date(Date.now() - 3600_000) },
  ] as never);
  await db.insert(institutions).values({ canonicalName: "Pending Institute", verificationStatus: "pending", source: "user" } as never);
});

describe("Overview aggregates", () => {
  it("platform summary counts the whole population and excludes deleted accounts", async () => {
    const s = await overview.platformSummary();
    // 35 seeded active accounts + the admin's own account (role student by default); the deleted one is excluded.
    expect(s).toMatchObject({ total: 36, students: 31, faculty: 3, alumni: 2, onboarded: 12, notOnboarded: 24, resumes: 7, connected: 4 });
    expect(s.connectionsBySource).toEqual([{ source: "github", users: 3 }, { source: "kaggle", users: 1 }, { source: "linkedin", users: 1 }]);
  });

  it("monthly trends come from real timestamps, zero-filled, 12 months", async () => {
    const g = await overview.growthTrends(12, NOW);
    expect(g.registrations).toHaveLength(12);
    const key = (d: Date) => d.toISOString().slice(0, 7);
    const at = (arr: { month: string; value: number }[], d: Date) => arr.find((x) => x.month === key(d))!.value;
    expect(at(g.registrations, monthsAgo(2))).toBe(4);
    expect(at(g.registrations, NOW)).toBe(32); // 31 seeded this month (one deleted) + the admin
    expect(at(g.onboardings, monthsAgo(1))).toBe(1);
    expect(at(g.resumeUploads, NOW)).toBe(8); // the deleted user's upload is excluded
    expect(at(g.registrations, monthsAgo(5))).toBe(0);
  });

  it("action-required counts real queue items", async () => {
    const a = await overview.actionRequired();
    expect(a).toMatchObject({ openTickets: 2, urgentTickets: 1, overdueTickets: 1, failedJobs24h: 1, failedJobsTotal: 1, staleQueuedJobs: 1, pendingInstitutions: 1 });
  });

  it("AI trend is zero-filled and never invents usage", async () => {
    const t = await overview.aiUsageTrend(6, NOW);
    expect(t).toHaveLength(6);
    expect(t.every((m) => m.calls === 0 && m.meteredUsd === 0 && m.estimatedUsd === 0)).toBe(true);
  });

  it("the Overview renders those values, links to the work, and writes nothing", async () => {
    const tables = ["email_templates", "email_template_versions", "knowledge_base_articles", "cms_announcements", "admin_audit_logs", "jobs"];
    const before = await Promise.all(tables.map(count));
    const { default: Overview } = await import("@/app/admin/page");
    const out = renderToStaticMarkup(await Overview());
    expect(out).toContain("Registered accounts");
    expect(out).toMatch(/Registered accounts<\/div><div[^>]*>36</);
    expect(out).toContain("31 students · 3 faculty · 2 alumni");
    expect(out).toContain('href="/admin/institutions"');
    expect(out).toContain("Background jobs failed in the last 24 hours");
    expect(out).toContain("Not monitored");
    expect(out).toContain("No AI calls recorded this month.");
    expect(await Promise.all(tables.map(count))).toEqual(before);
  });
});

describe("Student Directory", () => {
  it("paginates with an accurate total across the full matching population", async () => {
    const p1 = await listStudents({ limit: 25, offset: 0 });
    const p2 = await listStudents({ limit: 25, offset: 25 });
    expect(p1.total).toBe(36);
    expect(p1.students).toHaveLength(25);
    expect(p2.students).toHaveLength(11);
    expect(new Set([...p1.students, ...p2.students].map((s) => s.id)).size).toBe(36);
  });

  it("filters by persona, institution, degree, academic year, graduation year and onboarding", async () => {
    expect((await listStudents({ role: "faculty" })).total).toBe(3);
    expect((await listStudents({ university: "iit hyd" })).total).toBe(10);
    expect((await listStudents({ degree: "M.Sc" })).total).toBe(17);
    expect((await listStudents({ academicYear: "4th year" })).total).toBe(11); // 3, 6 … 33; 36 is deleted
    expect((await listStudents({ graduationYear: 2026 })).total).toBe(17);
    expect((await listStudents({ onboarding: "complete" })).total).toBe(12);
    expect((await listStudents({ onboarding: "incomplete" })).total).toBe(24);
    expect((await listStudents({ role: "student", onboarding: "complete", degree: "B.Tech" })).total).toBe(6);
  });

  it("search escapes LIKE wildcards and sorting works", async () => {
    expect((await listStudents({ query: "%" })).total).toBe(0);
    expect((await listStudents({ query: "person 07" })).students.map((s) => s.email)).toEqual(["u07@example.test"]);
    const byName = await listStudents({ sort: "name", limit: 3 });
    expect(byName.students.map((s) => s.name)).toEqual(["Ops", "Person 01", "Person 02"]);
    const oldest = await listStudents({ sort: "oldest", limit: 1 });
    expect(oldest.students[0]!.createdAt.getTime()).toBeLessThan(NOW.getTime() - 86_400_000);
  });

  it("filter options come from the data", async () => {
    const f = await listStudentFacets();
    expect(f.degrees).toEqual(["B.Tech", "M.Sc"]);
    expect(f.graduationYears).toEqual([2026, 2027]);
  });

  it("the Student 360 link appears only with intelligence.read", async () => {
    const { default: Directory } = await import("@/app/admin/students/page");
    perms.superAdmin = true;
    const withIntel = renderToStaticMarkup(await Directory({ searchParams: Promise.resolve({ role: "faculty" }) }));
    expect(withIntel).toContain("Showing 1–3 of 3 matching accounts");
    expect(withIntel).toContain("/admin/intelligence/students/");

    perms.superAdmin = false;
    perms.list = ["students.read"];
    const without = renderToStaticMarkup(await Directory({ searchParams: Promise.resolve({ role: "faculty" }) }));
    expect(without).toContain("Showing 1–3 of 3 matching accounts");
    expect(without).not.toContain("/admin/intelligence/students/");
    expect(without).not.toContain("Student 360");
    perms.superAdmin = true;
    perms.list = [];
  });

  it("page 2 of a filtered list keeps the filters in its links", async () => {
    const { default: Directory } = await import("@/app/admin/students/page");
    const out = renderToStaticMarkup(await Directory({ searchParams: Promise.resolve({ role: "student" }) }));
    expect(out).toContain("Showing 1–25 of 31 matching accounts");
    expect(out).toContain('href="/admin/students?role=student&amp;page=2"');
  });
});

describe("Account detail", () => {
  it("shows real onboarding and resume facts", async () => {
    const { default: Detail } = await import("@/app/admin/students/[id]/page");
    const out = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: uid(1) }) }));
    expect(out).toContain("Finished");
    expect(out).toContain("4 KB");
    expect(out).toContain("Open Student 360");
    const none = renderToStaticMarkup(await Detail({ params: Promise.resolve({ id: uid(30) }) }));
    expect(none).toContain("No resume uploaded.");
    expect(none).toContain("Not started.");
  });
});

describe("Template Studio", () => {
  it("opening it no longer seeds templates", async () => {
    const before = await count("email_templates");
    const { default: Templates } = await import("@/app/admin/emails/templates/page");
    const out = renderToStaticMarkup(await Templates());
    expect(await count("email_templates")).toBe(before);
    if (before === 0) expect(out).toContain("No email templates in the database.");
  });
});
