import { and, eq, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Every route and action that can queue paid work, called directly, past its limit.
vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: () => {} }));
vi.mock("next-auth", () => ({ AuthError: class extends Error {} }));
vi.mock("next/cache", () => ({ refresh: () => {}, revalidatePath: () => {} }));
vi.mock("@/auth", () => ({ auth: async () => null, signIn: async () => {}, signOut: async () => {}, unstable_update: async () => {} }));
const current = vi.hoisted(() => ({ user: { id: "", role: "student", email: "x@example.com" } as { id: string; role: string; email: string } }));
vi.mock("@/lib/dal", () => {
  const state = { currentStep: "done" };
  const page = async () => ({ user: current.user, state });
  const api = async () => ({ ok: true, user: current.user, state });
  return { requireConnectorUser: page, requireOnboardedUser: page, getCurrentUser: async () => current.user, getOnboardingState: async () => state, getApiUserAtStep: api, getApiOnboardedUser: api };
});
const r2 = vi.hoisted(() => ({ head: null as null | { sizeBytes: number; mime: string; sha256Base64: string | null } }));
vi.mock("@/lib/r2", () => ({
  isR2Configured: () => true,
  headObject: async () => r2.head,
  presignResumeUpload: async () => ({ url: "https://r2.test/put", headers: {} }),
  deleteObject: async () => {},
  listObjectKeys: async () => [],
  UPLOAD_URL_TTL_SECONDS: 300,
}));
const dispatch = vi.hoisted(() => vi.fn(async () => ({ delivered: 1, retrying: 0, failed: 0 })));
vi.mock("@/lib/integrations/webhooks", async (original) => ({ ...(await original<typeof import("@/lib/integrations/webhooks")>()), dispatchWebhooks: dispatch }));

process.env.CONNECTOR_TOKEN_KEY = Buffer.alloc(32, 3).toString("base64");
process.env.GITHUB_CLIENT_ID = "id";
process.env.GITHUB_CLIENT_SECRET = "secret";
process.env.ORCID_CLIENT_ID = "id";
process.env.ORCID_CLIENT_SECRET = "secret";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_URL = "https://collaborate.test/hook";
process.env.INTEGRATION_COLLABORATE_WEBHOOK_SECRET = "webhook-secret";

const { db } = await import("@/db");
const { connections, consents, files, integrationConsents, jobs, onboardingState, users } = await import("@/db/schema");
const { hexToBase64 } = await import("@/lib/uploads/resume");

let next = 1;
beforeEach(async () => {
  const id = `00000000-0000-4000-8000-${String(next++).padStart(12, "0")}`;
  await db.insert(users).values({ id, email: `${id}@example.com` });
  await db.insert(onboardingState).values({ userId: id, currentStep: "done" });
  current.user = { id, role: "student", email: `${id}@example.com` };
  dispatch.mockClear();
});

const me = () => current.user.id;
const jobsOf = (type: "resume_extract" | "connector_sync" | "compute_intelligence") => db.select().from(jobs).where(and(eq(jobs.userId, me()), eq(jobs.type, type)));
const finishJobs = () => db.update(jobs).set({ status: "done" }).where(eq(jobs.userId, me()));

const upload = (n: number) => ({ fileName: "cv.pdf", sizeBytes: 10, mime: "application/pdf", sha256: n.toString(16).padStart(64, "0") });
const post = (url: string, body: unknown) => new Request(`https://app.test${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("POST /api/upload/resume/complete", () => {
  it("queues 20 extractions a day, then answers 429 and queues nothing", async () => {
    const { POST } = await import("@/app/api/upload/resume/complete/route");
    for (let i = 1; i <= 20; i++) {
      r2.head = { sizeBytes: 10, mime: "application/pdf", sha256Base64: hexToBase64(upload(i).sha256) };
      expect((await POST(post("/api/upload/resume/complete", upload(i)))).status).toBe(201);
    }
    r2.head = { sizeBytes: 10, mime: "application/pdf", sha256Base64: hexToBase64(upload(21).sha256) };
    expect((await POST(post("/api/upload/resume/complete", upload(21)))).status).toBe(429);
    expect(await jobsOf("resume_extract")).toHaveLength(20);
  });
});

describe("POST /api/upload/resume", () => {
  it("limits re-running a known file, which can restart a failed extraction", async () => {
    const { POST } = await import("@/app/api/upload/resume/route");
    await db.insert(files).values({ userId: me(), kind: "resume", storageKey: "k", sha256: upload(1).sha256, sizeBytes: 10, mime: "application/pdf" });
    for (let i = 0; i < 20; i++) expect((await POST(post("/api/upload/resume", upload(1)))).status).toBe(200);
    expect((await POST(post("/api/upload/resume", upload(1)))).status).toBe(429);
  });
});

describe("connector start routes", () => {
  const start = async (source: "github" | "orcid") => {
    const { GET } = await import(`@/app/api/connectors/${source}/start/route`);
    return (await GET(new NextRequest(`https://app.test/api/connectors/${source}/start?from=connections`))) as Response;
  };

  it.each(["github", "orcid"] as const)("%s redirects to the provider until the shared limit, then back with an error", async (source) => {
    for (let i = 0; i < 30; i++) expect((await start(source)).headers.get("location")).not.toContain("error=");
    const refused = await start(source);
    expect(refused.headers.get("location")).toContain("error=limited");
    expect(refused.headers.get("set-cookie")).toBeNull();
  });

  it("shares one limit between the two", async () => {
    for (let i = 0; i < 15; i++) await start("github");
    for (let i = 0; i < 15; i++) await start("orcid");
    expect((await start("github")).headers.get("location")).toContain("error=limited");
  });
});

describe("connectWithForm", () => {
  it("stops at its hourly limit", async () => {
    const { connectWithForm } = await import("@/app/(dashboard)/connections/actions");
    for (let i = 0; i < 20; i++) expect(await connectWithForm("leetcode", { username: "someone" })).toEqual({ ok: true });
    expect((await connectWithForm("leetcode", { username: "someone" })).ok).toBe(false);
  });

  it("also obeys the daily limit shared with OAuth connects", async () => {
    const { connectWithForm } = await import("@/app/(dashboard)/connections/actions");
    const { GET } = await import("@/app/api/connectors/github/start/route");
    for (let i = 0; i < 30; i++) await GET(new NextRequest("https://app.test/api/connectors/github/start"));
    expect((await connectWithForm("leetcode", { username: "someone" })).ok).toBe(false);
    expect(await jobsOf("connector_sync")).toEqual([]);
  });
});

describe("refreshGithub", () => {
  it("queues 10 an hour and then refuses", async () => {
    const { refreshGithub } = await import("@/app/(dashboard)/dashboard/actions");
    await db.insert(connections).values({ userId: me(), sourceId: "github", accessMethod: "oauth", status: "connected" });
    for (let i = 0; i < 10; i++) {
      expect(await refreshGithub()).toEqual({ ok: true });
      await finishJobs();
    }
    expect((await refreshGithub()).ok).toBe(false);
    expect(await jobsOf("connector_sync")).toHaveLength(10);
  });
});

describe("syncIntegration", () => {
  it("runs a dispatch 10 times an hour and then refuses", async () => {
    const { syncIntegration } = await import("@/app/(dashboard)/settings/integrations/actions");
    await db.insert(integrationConsents).values({ userId: me(), clientId: "collaborate", scopes: {}, hiddenProjects: [], linkedAt: new Date() });
    for (let i = 0; i < 10; i++) expect((await syncIntegration("collaborate")).ok).toBe(true);
    expect((await syncIntegration("collaborate")).ok).toBe(false);
    expect(dispatch).toHaveBeenCalledTimes(10);
  });
});

describe("consent writers", () => {
  const grants = async (purpose: "external_ai" | "linkedin_scrape") =>
    (await db.select().from(consents).where(and(eq(consents.userId, me()), eq(consents.purpose, purpose), eq(consents.granted, true)))).length;

  it("setExternalAiConsent refuses a 31st grant but always accepts a withdrawal", async () => {
    const { setExternalAiConsent } = await import("@/app/onboarding/resume/actions");
    for (let i = 0; i < 30; i++) {
      expect(await setExternalAiConsent(true)).toEqual({ ok: true });
      expect(await setExternalAiConsent(false)).toEqual({ ok: true });
    }
    expect((await setExternalAiConsent(true)).ok).toBe(false);
    expect(await setExternalAiConsent(false)).toEqual({ ok: true });
    expect(await grants("external_ai")).toBe(30);
  });

  it("allowLinkedInImport queues at most one sync however often it's granted", async () => {
    const { allowLinkedInImport } = await import("@/app/(dashboard)/connections/actions");
    await db.insert(connections).values({ userId: me(), sourceId: "linkedin", accessMethod: "oauth", status: "connected" });
    for (let i = 0; i < 5; i++) {
      await allowLinkedInImport();
      await db.delete(consents).where(eq(consents.userId, me())); // so the next call is a new grant
    }
    expect(await jobsOf("connector_sync")).toHaveLength(1);
  });

  it("savePrivacyConsents and POST /api/consents both report a refused grant", async () => {
    const { savePrivacyConsents } = await import("@/app/(dashboard)/settings/privacy/actions");
    const { POST } = await import("@/app/api/consents/route");
    const off = { external_ai: false, linkedin_scrape: false, analytics: false, mentor_discovery: false };
    for (let i = 0; i < 15; i++) {
      await savePrivacyConsents({ ...off, analytics: true });
      await savePrivacyConsents(off);
    }
    for (let i = 0; i < 15; i++) {
      await POST(post("/api/consents", { ...off, analytics: true }));
      await POST(post("/api/consents", off));
    }
    expect((await savePrivacyConsents({ ...off, analytics: true })).ok).toBe(false);
    expect((await POST(post("/api/consents", { ...off, analytics: true }))).status).toBe(429);
    expect((await POST(post("/api/consents", off))).status).toBe(200);
  });
});

describe("recomputes", () => {
  it("postpones past the limit instead of dropping, whichever caller queues them", async () => {
    const { disconnect } = await import("@/app/(dashboard)/connections/actions");
    for (let i = 0; i < 30; i++) {
      await db.insert(connections).values({ userId: me(), sourceId: "kaggle", accessMethod: "api_key", status: "connected" }).onConflictDoNothing();
      await disconnect("kaggle");
      const [job] = await db.select().from(jobs).where(and(eq(jobs.userId, me()), eq(jobs.status, "queued")));
      expect(job.runAt.getTime()).toBeLessThanOrEqual(Date.now() + 1000);
      await finishJobs();
    }
    await disconnect("kaggle");
    const [postponed] = await db.select().from(jobs).where(and(eq(jobs.userId, me()), eq(jobs.status, "queued")));
    expect(postponed.runAt.getTime()).toBeGreaterThan(Date.now() + 60_000);

    await disconnect("kaggle"); // collapses into the waiting one
    const { rows } = await db.execute(sql`SELECT count(*)::int AS n FROM jobs WHERE user_id = ${me()} AND status = 'queued'`);
    expect((rows[0] as { n: number }).n).toBe(1);
  });
});
