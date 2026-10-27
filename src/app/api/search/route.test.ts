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
const { codeRepositories, consents, unifiedProjects, users } = await import("@/db/schema");
const { GET } = await import("./route");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ME = id(1); // student
const MENTOR = id(2); // faculty, "Neural" in the department
const OTHER_STUDENT = id(3); // student, no consent
const CONSENTING_STUDENT = id(4);
const FACULTY_VIEWER = id(5);

const search = async (q: string) => {
  const res = await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(q)}`));
  return { status: res.status, body: await res.json() };
};

beforeAll(async () => {
  await db.insert(users).values([
    { id: ME, name: "Asha Rao", role: "student" },
    { id: MENTOR, name: "Dr. Neha Iyer", role: "faculty", department: "Neural Systems Lab" },
    { id: OTHER_STUDENT, name: "Neil Shah", role: "student" },
    { id: CONSENTING_STUDENT, name: "Neeraj Gupta", role: "student" },
    { id: FACULTY_VIEWER, name: "Prof. Kumar", role: "faculty" },
  ]);
  await db.insert(consents).values({ userId: CONSENTING_STUDENT, purpose: "mentor_discovery", granted: true });
  await db.insert(codeRepositories).values([
    { userId: ME, source: "github", repoName: "asha/neural-search" },
    { userId: OTHER_STUDENT, source: "github", repoName: "neil/neural-private-thesis" },
  ]);
  await db.insert(unifiedProjects).values([
    { userId: ME, canonicalTitle: "Neural ranking" },
    { userId: OTHER_STUDENT, canonicalTitle: "Neural secret project" },
  ]);
});

describe("GET /api/search", () => {
  it("requires a session", async () => {
    state.sessionUserId = null;
    expect((await search("ne")).status).toBe(401);
  });

  it("finds people (the role enum no longer breaks the query) but only discoverable ones", async () => {
    state.sessionUserId = ME;
    const { status, body } = await search("ne");
    expect(status).toBe(200);
    const names = body.results.people.map((p: { title: string }) => p.title);
    expect(names).toContain("Dr. Neha Iyer");
    // A student viewer never sees other students, consenting or not.
    expect(names).not.toContain("Neil Shah");
    expect(names).not.toContain("Neeraj Gupta");
  });

  it("matches on the role text", async () => {
    state.sessionUserId = ME;
    const { body } = await search("faculty");
    expect(body.results.people.map((p: { title: string }) => p.title)).toContain("Dr. Neha Iyer");
  });

  it("shows faculty only the students who consented to mentor discovery", async () => {
    state.sessionUserId = FACULTY_VIEWER;
    const names = (await search("ne")).body.results.people.map((p: { title: string }) => p.title);
    expect(names).toContain("Neeraj Gupta");
    expect(names).not.toContain("Neil Shah");
  });

  it("returns only the signed-in user's own projects and repositories", async () => {
    state.sessionUserId = ME;
    const titles = (await search("neural")).body.results.projects.map((p: { title: string }) => p.title);
    expect(titles).toEqual(expect.arrayContaining(["Neural ranking", "asha/neural-search"]));
    expect(titles).not.toContain("Neural secret project");
    expect(titles).not.toContain("neil/neural-private-thesis");
  });

  it("treats LIKE wildcards in the query literally", async () => {
    state.sessionUserId = ME;
    const { body } = await search("%%");
    expect(body.results.people).toEqual([]);
    expect(body.results.projects).toEqual([]);
  });
});
