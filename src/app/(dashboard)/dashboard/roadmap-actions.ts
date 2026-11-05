"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { profileViews } from "@/db/schema";
import { requireOnboardedUser } from "@/lib/dal";
import type { ProfileViewDoc } from "@/lib/dashboard/types";
import { submitMilestoneEvidence, type SubmitResult } from "@/lib/roadmap/submissions";
import { wakeWorker } from "@/lib/worker-ping";

/** Submit a link to work for a roadmap milestone. Pending until the engine's evidence confirms it. */
export async function submitRoadmapEvidence(input: { milestoneId: string; evidenceUrl: string; note?: string }): Promise<SubmitResult> {
  const { user } = await requireOnboardedUser();
  if (typeof input?.milestoneId !== "string" || typeof input?.evidenceUrl !== "string" || input.milestoneId.length > 200) {
    return { ok: false, error: "Invalid submission." };
  }
  try {
    const [row] = await db.select({ view: profileViews.view }).from(profileViews).where(eq(profileViews.userId, user.id));
    const result = await submitMilestoneEvidence(db, user.id, (row?.view as ProfileViewDoc | undefined)?.intelligence?.roadmap, {
      milestoneId: input.milestoneId,
      evidenceUrl: input.evidenceUrl,
      note: typeof input.note === "string" ? input.note : null,
    });
    if (result.ok) {
      wakeWorker("compute_intelligence:milestone");
      revalidatePath("/dashboard");
    }
    return result;
  } catch (error) {
    console.error("submitRoadmapEvidence failed", error);
    return { ok: false, error: "We couldn't save that. Try again." };
  }
}
