/**
 * Resume duplicate detection through the real upload routes on PGlite (R2 and sign-in mocked):
 * identical bytes (any filename) map to one file and one extraction job per student, a finished
 * extraction is never re-run for the same bytes, and other students are unaffected.
 */
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/db", async () => {
  const { createTestDb } = await import("@/test/db");
  return { db: await createTestDb() };
});
vi.mock("@/lib/worker-ping", () => ({ wakeWorker: () => {} }));
const current = vi.hoisted(() => ({ user: { id: "", role: "student", email: "x@example.com" } }));
vi.mock("@/lib/dal", () => {
  const state = { currentStep: "resume" };
  const api = async () => ({ ok: true, user: current.user, state });
  return { getApiUserAtStep: api, getApiOnboardedUser: api };
});
const r2 = vi.hoisted(() => ({ objects: new Map<string, { sizeBytes: number; mime: string; sha256Base64: string | null }>() }));
vi.mock("@/lib/r2", () => ({
  isR2Configured: () => true,
  headObject: async (key: string) => r2.objects.get(key) ?? null,
  presignResumeUpload: async () => ({ url: "https://r2.test/put", headers: {} }),
}));

const { db } = await import("@/db");
const { files, jobs, onboardingState, users } = await import("@/db/schema");
const { hexToBase64, resumeStorageKey } = await import("@/lib/uploads/resume");
const presign = (await import("@/app/api/upload/resume/route")).POST;
const complete = (await import("@/app/api/upload/resume/complete/route")).POST;

let next = 1;
async function newStudent() {
  const id = `00000000-0000-4000-a000-${String(next++).padStart(12, "0")}`;
  await db.insert(users).values({ id, email: `${id}@example.com` });
  await db.insert(onboardingState).values({ userId: id, currentStep: "resume" });
  current.user = { id, role: "student", email: `${id}@example.com` };
  return id;
}
const sha = (n: number) => n.toString(16).padStart(64, "a");
const meta = (n: number, fileName = "cv.pdf") => ({ fileName, sizeBytes: 1000 + n, mime: "application/pdf", sha256: sha(n) });
const post = (url: string, body: unknown) =>
  new Request(`https://app.test${url}`, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
/** What R2 holds after the browser's PUT (R2 itself enforces the signed checksum). */
const putInR2 = (userId: string, m: ReturnType<typeof meta>) =>
  r2.objects.set(resumeStorageKey(userId, m.sha256, "application/pdf"), { sizeBytes: m.sizeBytes, mime: m.mime, sha256Base64: hexToBase64(m.sha256) });
const filesOf = (u: string) => db.select().from(files).where(eq(files.userId, u));
const jobsOf = (u: string) => db.select().from(jobs).where(and(eq(jobs.userId, u), eq(jobs.type, "resume_extract")));

async function upload(userId: string, m: ReturnType<typeof meta>) {
  const first = await (await presign(post("/api/upload/resume", m))).json();
  if (first.duplicate) return first as { duplicate: true; jobId: string };
  putInR2(userId, m);
  const res = await complete(post("/api/upload/resume/complete", m));
  return { duplicate: false, ...(await res.json()) } as { duplicate: false; jobId: string };
}

beforeEach(async () => {
  r2.objects.clear();
  await newStudent();
});

describe("resume duplicate detection", () => {
  it("same bytes, same filename: detected, one file, one job", async () => {
    const me = current.user.id;
    const a = await upload(me, meta(1));
    const b = await upload(me, meta(1));
    expect(b).toEqual({ duplicate: true, jobId: a.jobId });
    expect(await filesOf(me)).toHaveLength(1);
    expect(await jobsOf(me)).toHaveLength(1);
  });

  it("same bytes, different filename: still detected (the filename plays no part)", async () => {
    const me = current.user.id;
    const a = await upload(me, meta(1, "Resume_final.pdf"));
    const b = await upload(me, meta(1, "resume (2) copy.pdf"));
    expect(b).toEqual({ duplicate: true, jobId: a.jobId });
    expect(await filesOf(me)).toHaveLength(1);
  });

  it("a different resume is accepted as a new file with its own extraction", async () => {
    const me = current.user.id;
    const a = await upload(me, meta(1));
    const b = await upload(me, meta(2));
    expect(b.duplicate).toBe(false);
    expect(b.jobId).not.toBe(a.jobId);
    expect(await filesOf(me)).toHaveLength(2);
  });

  it("a finished extraction is not re-run for the same bytes (no repeat AI)", async () => {
    const me = current.user.id;
    const a = await upload(me, meta(1));
    await db.update(jobs).set({ status: "done", finishedAt: new Date() }).where(eq(jobs.id, a.jobId));
    await upload(me, meta(1, "again.pdf"));
    const [job] = await jobsOf(me);
    expect(job.status).toBe("done");
    expect(await jobsOf(me)).toHaveLength(1);
  });

  it("concurrent completions of the same upload converge on one file and one job", async () => {
    const me = current.user.id;
    const m = meta(3);
    putInR2(me, m);
    const results = await Promise.all([1, 2, 3].map(() => complete(post("/api/upload/resume/complete", m)).then((r) => r.json())));
    expect(new Set(results.map((r) => r.jobId)).size).toBe(1);
    expect(await filesOf(me)).toHaveLength(1);
    expect(await jobsOf(me)).toHaveLength(1);
  });

  it("different students uploading the same file are each accepted", async () => {
    const first = current.user.id;
    await upload(first, meta(1));
    const second = await newStudent();
    const b = await upload(second, meta(1));
    expect(b.duplicate).toBe(false);
    expect(await filesOf(first)).toHaveLength(1);
    expect(await filesOf(second)).toHaveLength(1);
  });

  it("an object whose stored checksum differs from the declared one is refused", async () => {
    const me = current.user.id;
    const m = meta(4);
    r2.objects.set(resumeStorageKey(me, m.sha256, "application/pdf"), { sizeBytes: m.sizeBytes, mime: m.mime, sha256Base64: hexToBase64(sha(5)) });
    expect((await complete(post("/api/upload/resume/complete", m))).status).toBe(422);
    expect(await filesOf(me)).toHaveLength(0);
  });
});
