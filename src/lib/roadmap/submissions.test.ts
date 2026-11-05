import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";

import { jobs, users } from "@/db/schema";
import type { EngineRoadmap } from "@/lib/dashboard/types";
import { createTestDb } from "@/test/db";

import { roadmapProgress } from "./progress";
import { listMilestoneSubmissions, submitMilestoneEvidence } from "./submissions";

const roadmap: EngineRoadmap = {
  role: "ml_engineer",
  currentPosition: null,
  progress: 0.2,
  completed: ["Python"],
  stages: [
    {
      key: "foundation",
      title: "Build the foundations",
      estimateWeeks: 4,
      milestones: [{ id: "ml_engineer:statistics", skill: "Statistics", state: "missing", done: false, requires: [], deliverable: "x", criterion: "y", estimateWeeks: 4 }],
    },
  ],
  assumption: "",
};

describe("roadmap milestone submissions (persistence)", () => {
  let db: Awaited<ReturnType<typeof createTestDb>>;
  let userId: string;
  beforeAll(async () => {
    db = await createTestDb();
    const [u] = await db.insert(users).values({ email: "roadmap@test.local", name: "R" }).returning({ id: users.id });
    userId = u.id;
  }, 60_000);

  it("rejects milestones that aren't on the roadmap and non-https links", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = db as any;
    expect(await submitMilestoneEvidence(d, userId, roadmap, { milestoneId: "ml_engineer:sql", evidenceUrl: "https://github.com/a/b" })).toMatchObject({ ok: false });
    expect(await submitMilestoneEvidence(d, userId, roadmap, { milestoneId: "ml_engineer:statistics", evidenceUrl: "http://github.com/a/b" })).toMatchObject({ ok: false });
    expect(await submitMilestoneEvidence(d, userId, roadmap, { milestoneId: "ml_engineer:statistics", evidenceUrl: "javascript:alert(1)" })).toMatchObject({ ok: false });
    expect(await submitMilestoneEvidence(d, userId, null, { milestoneId: "ml_engineer:statistics", evidenceUrl: "https://github.com/a/b" })).toMatchObject({ ok: false });
  });

  it("persists a submission as pending, queues one refresh, and doesn't complete the milestone", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const d = db as any;
    const input = { milestoneId: "ml_engineer:statistics", evidenceUrl: "https://github.com/alice/stats-project" };
    expect(await submitMilestoneEvidence(d, userId, roadmap, input)).toEqual({ ok: true });
    expect(await submitMilestoneEvidence(d, userId, roadmap, input)).toEqual({ ok: true }); // idempotent

    const subs = await listMilestoneSubmissions(d, userId);
    expect(subs).toHaveLength(1);
    const queued = await db.select().from(jobs).where(eq(jobs.userId, userId));
    expect(queued).toHaveLength(1);
    expect(queued[0].type).toBe("compute_intelligence");

    // Read back in a "new session": still pending, progress unchanged.
    const p = roadmapProgress(roadmap, "2020-01-01T00:00:00Z", subs);
    expect(p.steps[0].status).toBe("submitted");
    expect(p.progress).toBe(0.2);
  });

  it("refuses evidence for a milestone the engine already completed", async () => {
    const done = { ...roadmap, stages: [{ ...roadmap.stages[0], milestones: [{ ...roadmap.stages[0].milestones[0], done: true, state: "met" as const }] }] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await submitMilestoneEvidence(db as any, userId, done, { milestoneId: "ml_engineer:statistics", evidenceUrl: "https://x.dev/y" })).toMatchObject({ ok: false });
  });
});
