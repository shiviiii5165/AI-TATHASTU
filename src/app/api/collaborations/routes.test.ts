import { beforeEach, describe, expect, it, vi } from "vitest";

// The HTTP surface: public reads without a session, sign-in for everything else, CSRF refusal, and no private
// fields in responses. Service rules themselves are covered in lib/collaborations/service.test.ts.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
const session = vi.hoisted(() => ({ userId: null as string | null }));
vi.mock("@/auth", () => ({ auth: async () => (session.userId ? { user: { id: session.userId } } : null) }));
vi.mock("@/lib/dal", async () => {
  const { db } = await import("@/db");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  return {
    getApiOnboardedUser: async () => {
      if (!session.userId) return { ok: false, status: 401, error: "Sign in to continue." };
      const [user] = await db.select().from(users).where(eq(users.id, session.userId));
      return { ok: true, user, state: { currentStep: "done" } };
    },
  };
});
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", async (orig) => ({ ...(await orig<typeof import("next/server")>()), connection: async () => {} }));

const { db } = await import("@/db");
const { users } = await import("@/db/schema");
const list = await import("./route");
const one = await import("./[id]/route");
const act = await import("./[id]/[action]/route");
const apps = await import("./applications/[appId]/route");
const me = await import("./me/route");
const lifecycle = await import("../internal/collaborations/lifecycle/route");

const URL_BASE = "http://localhost:3000/api/collaborations";
const post = (url: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "sec-fetch-site": "same-origin", ...headers } });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

let n = 0;
async function signIn(extra: Partial<typeof users.$inferInsert> = {}) {
  const [u] = await db.insert(users).values({ email: `r${++n}@example.com`, name: `Route User ${n}`, ...extra }).returning();
  session.userId = u.id;
  return u;
}
const draft = {
  category: "project",
  title: "Open source campus map",
  summary: "Accessible maps for our campus.",
  roles: [{ title: "Mapper", count: 2, skills: ["gis"] }],
  deadline: new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10),
};

beforeEach(() => {
  session.userId = null;
});

describe("public discovery", () => {
  it("lists and reads published collaborations without signing in, with no private fields", async () => {
    const owner = await signIn({ university: "Hidden University" });
    const created = await list.POST(post(URL_BASE, { publish: true, post: draft }));
    expect(created.status).toBe(201);
    const { id } = await created.json();
    session.userId = null;

    const res = await list.GET(new Request(`${URL_BASE}?q=campus`));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(id);
    for (const secret of [owner.id, owner.email!, "Hidden University"]) expect(body).not.toContain(secret);

    const detail = await one.GET(new Request(`${URL_BASE}/${id}`), params({ id }));
    expect(detail.status).toBe(200);
    expect((await detail.json()).viewer).toBeNull();
  });

  it("rejects malformed filters", async () => {
    expect((await list.GET(new Request(`${URL_BASE}?category=weapons`))).status).toBe(400);
  });
});

describe("sign-in is required for everything else", () => {
  it("create, apply, decide, enquire and private views answer 401 to visitors", async () => {
    const id = "00000000-0000-4000-8000-000000000001";
    expect((await list.POST(post(URL_BASE, { publish: true, post: draft }))).status).toBe(401);
    expect((await act.POST(post(`${URL_BASE}/${id}/apply`, { intro: "x", motivation: "y" }), params({ id, action: "apply" }))).status).toBe(401);
    expect((await act.POST(post(`${URL_BASE}/${id}/enquiry`, { body: "x" }), params({ id, action: "enquiry" }))).status).toBe(401);
    expect((await apps.POST(post(`${URL_BASE}/applications/${id}`, { action: "accept" }), params({ appId: id }))).status).toBe(401);
    expect((await me.GET(new Request(`${URL_BASE}/me?view=requests`))).status).toBe(401);
    expect((await act.GET(new Request(`${URL_BASE}/${id}/members`), params({ id, action: "members" }))).status).toBe(401);
  });
});

describe("CSRF", () => {
  it("refuses cross-site and sibling-subdomain writes before any work", async () => {
    await signIn();
    for (const site of ["cross-site", "same-site"]) {
      const res = await list.POST(post(URL_BASE, { publish: true, post: draft }, { "sec-fetch-site": site }));
      expect(res.status).toBe(403);
    }
  });
});

describe("the full flow over HTTP", () => {
  it("publish → apply → accept → member roster, with the applicant unable to accept themselves", async () => {
    await signIn();
    const { id } = await (await list.POST(post(URL_BASE, { publish: true, post: { ...draft, title: "HTTP flow project" } }))).json();
    const ownerId = session.userId;

    await signIn();
    const applied = await act.POST(post(`${URL_BASE}/${id}/apply`, { intro: "I map things", motivation: "Accessibility matters" }), params({ id, action: "apply" }));
    expect(applied.status).toBe(201);
    const { id: appId } = await applied.json();
    expect((await apps.POST(post(`${URL_BASE}/applications/${appId}`, { action: "accept" }), params({ appId }))).status).toBe(404);

    session.userId = ownerId;
    const accepted = await apps.POST(post(`${URL_BASE}/applications/${appId}`, { action: "accept" }), params({ appId }));
    expect(await accepted.json()).toEqual({ status: "accepted" });
    const roster = await (await act.GET(new Request(`${URL_BASE}/${id}/members`), params({ id, action: "members" }))).json();
    expect(roster.members).toHaveLength(2);
    expect(JSON.stringify(roster)).not.toMatch(/@example\.com/);
  });
});

describe("lifecycle job", () => {
  it("requires the cron secret", async () => {
    expect((await lifecycle.POST(new Request("http://localhost/api/internal/collaborations/lifecycle", { method: "POST" }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "a-cron-secret-0123456789");
    const ok = await lifecycle.POST(new Request("http://localhost/api/internal/collaborations/lifecycle", { method: "POST", headers: { authorization: "Bearer a-cron-secret-0123456789" } }));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual(expect.objectContaining({ reminded: expect.any(Number), expired: expect.any(Number), flagged: expect.any(Number) }));
  });
});
