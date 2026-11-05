import { desc, eq, sql } from "drizzle-orm";

import type { db as appDb } from "@/db";
import { jobs, roadmapMilestoneSubmissions } from "@/db/schema";
import type { EngineRoadmap } from "@/lib/dashboard/types";

import { milestoneId, type MilestoneSubmission } from "./progress";

type Db = typeof appDb;

export const MAX_SUBMISSIONS_PER_USER = 100;

export type SubmitInput = { milestoneId: string; evidenceUrl: string; note?: string | null };
export type SubmitResult = { ok: true } | { ok: false; error: string };

function cleanUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:" || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString().slice(0, 500);
  } catch {
    return null;
  }
}

/**
 * Records evidence for a milestone of the user's current roadmap and queues an intelligence refresh.
 * The submission is only a claim: the milestone completes when the engine's evidence shows the skill
 * at its expected level, never because of this row.
 */
export async function submitMilestoneEvidence(database: Db, userId: string, roadmap: EngineRoadmap | null | undefined, input: SubmitInput): Promise<SubmitResult> {
  if (!roadmap) return { ok: false, error: "You don't have a roadmap yet." };
  const milestone = roadmap.stages.flatMap((s) => s.milestones).find((m) => (m.id ?? milestoneId(roadmap.role, m.skill)) === input.milestoneId);
  if (!milestone) return { ok: false, error: "That milestone isn't on your current roadmap." };
  if (milestone.done) return { ok: false, error: "This milestone is already completed from your evidence." };
  const url = cleanUrl(input.evidenceUrl);
  if (!url) return { ok: false, error: "Enter a full https:// link to your work." };
  const note = input.note?.trim().slice(0, 500) || null;

  const [{ count }] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(roadmapMilestoneSubmissions)
    .where(eq(roadmapMilestoneSubmissions.userId, userId));
  if (count >= MAX_SUBMISSIONS_PER_USER) return { ok: false, error: "You've reached the submission limit." };

  await database
    .insert(roadmapMilestoneSubmissions)
    .values({ userId, milestoneId: input.milestoneId, role: roadmap.role, skill: milestone.skill, evidenceUrl: url, note })
    .onConflictDoNothing();
  // Re-run the engine so new evidence (e.g. a just-pushed repository) is read. One job per submission link.
  await database
    .insert(jobs)
    .values({ type: "compute_intelligence", userId, idempotencyKey: `compute_intelligence:${userId}:milestone:${input.milestoneId}:${url}`.slice(0, 400), payload: { trigger: "milestone_evidence" } })
    .onConflictDoNothing({ target: jobs.idempotencyKey });
  return { ok: true };
}

export async function listMilestoneSubmissions(database: Db, userId: string): Promise<MilestoneSubmission[]> {
  return database
    .select({ milestoneId: roadmapMilestoneSubmissions.milestoneId, evidenceUrl: roadmapMilestoneSubmissions.evidenceUrl, createdAt: roadmapMilestoneSubmissions.createdAt })
    .from(roadmapMilestoneSubmissions)
    .where(eq(roadmapMilestoneSubmissions.userId, userId))
    .orderBy(desc(roadmapMilestoneSubmissions.createdAt));
}
