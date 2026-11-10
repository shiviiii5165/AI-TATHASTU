import { beforeEach, describe, expect, it, vi } from "vitest";

const VIEWER = "00000000-0000-4000-8000-0000000000b1";
const state = vi.hoisted(() => ({ sessionUserId: "00000000-0000-4000-8000-0000000000b1" as string | null }));

vi.mock("@/auth", () => ({ auth: async () => (state.sessionUserId ? { user: { id: state.sessionUserId } } : null) }));
vi.mock("next/server", async (importOriginal) => ({ ...(await importOriginal<typeof import("next/server")>()), connection: async () => {} }));
vi.mock("@/lib/rate-limit", () => ({ hitRateLimit: async () => ({ ok: true }) }));
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});

// pgvector isn't available in PGlite; the discovery rules behind similarPeople are covered in src/lib/discovery.test.ts.
const people = vi.hoisted(() => ({ result: [] as unknown[], limit: 0 }));
vi.mock("@/lib/people", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/people")>()),
  similarPeople: async (_viewer: unknown, limit: number) => {
    people.limit = limit;
    return (people.result as unknown[]).slice(0, limit);
  },
}));

const { db } = await import("@/db");
const { collaborationEmbeddings, users } = await import("@/db/schema");
const { GET } = await import("./route");

await db.insert(users).values({ id: VIEWER, name: "Kaustubh", role: "student", university: "Lovely Professional University" });
await db.insert(collaborationEmbeddings).values({ userId: VIEWER, profileSummary: "student at Lovely Professional University. Skills: Python, React, SQL. Projects: Secret Thesis." });

const person = (i: number, summary: string | null, institution: string | null = "IIT Delhi") => ({
  id: `00000000-0000-4000-8000-00000000010${i}`,
  name: `Dr. Mentor ${i}`,
  role: "faculty" as const,
  department: "CSE",
  institution,
  summary,
  similarity: 0.9 - i * 0.1,
});

describe("GET /api/collaboration/matches (People you may know)", () => {
  beforeEach(() => {
    state.sessionUserId = VIEWER;
    people.result = [];
  });

  it("returns at most three people, each with a genuine reason and no percentage", async () => {
    people.result = [
      person(1, "faculty at IIT Delhi. Skills: Python, SQL, Go. Projects: Their Private Project."),
      person(2, "faculty at LPU. Skills: Rust. Projects: x.", "Lovely Professional University"),
      person(3, "faculty at MIT. Skills: Haskell. Projects: y.", "MIT"),
      person(4, "faculty at X. Skills: Python. Projects: z."),
    ];
    const res = await GET();
    const { matches } = await res.json();
    expect(people.limit).toBeLessThanOrEqual(3);
    expect(matches).toHaveLength(3);
    expect(matches.map((m: { reason: string }) => m.reason)).toEqual(["You both work with Python and SQL", "Also at Lovely Professional University", "Similar skills and goals to yours"]);
    const body = JSON.stringify(matches);
    expect(body).not.toMatch(/matchPercentage|%/);
    // Project titles aren't covered by discovery consent, so they never leave the server.
    expect(body).not.toContain("Private Project");
    expect(body).not.toContain("Secret Thesis");
  });

  it("returns an empty list, not placeholders, when nobody eligible matches", async () => {
    const res = await GET();
    expect(await res.json()).toEqual({ matches: [] });
  });

  it("requires a signed-in user", async () => {
    state.sessionUserId = null;
    expect((await GET()).status).toBe(401);
  });
});
