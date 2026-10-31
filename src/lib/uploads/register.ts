import "server-only";

import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { files, jobs, onboardingState } from "@/db/schema";
import {
  RESUME_MAX_BYTES,
  RESUME_PIPELINE_VERSION,
  RESUME_TYPES,
  resumeJobKey,
  resumeStorageKey,
  type ResumeMime,
} from "@/lib/uploads/resume";
import { wakeWorker } from "@/lib/worker-ping";

export const resumeUploadSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(RESUME_MAX_BYTES),
  mime: z.enum(Object.keys(RESUME_TYPES) as [ResumeMime, ...ResumeMime[]]),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export type ResumeUpload = z.infer<typeof resumeUploadSchema>;

export async function findExistingResume(userId: string, sha256: string) {
  const [file] = await db
    .select({ id: files.id })
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.sha256, sha256)));
  return file ?? null;
}

/**
 * Records the file and enqueues extraction. Each write is idempotent (unique
 * user+sha256 and unique job key), so a retry after a partial failure, or a
 * double-submit, converges on the same file and job.
 */
export async function registerResume(userId: string, upload: ResumeUpload): Promise<{ jobId: string }> {
  const storageKey = resumeStorageKey(userId, upload.sha256, upload.mime);

  const [inserted] = await db
    .insert(files)
    .values({
      userId,
      kind: "resume",
      storageKey,
      sha256: upload.sha256,
      sizeBytes: upload.sizeBytes,
      mime: upload.mime,
    })
    .onConflictDoNothing({ target: [files.userId, files.sha256] })
    .returning({ id: files.id });
  const fileId = inserted?.id ?? (await findExistingResume(userId, upload.sha256))?.id;
  if (!fileId) {
    throw new Error(`Failed to resolve file ID for resume upload: ${userId}:${upload.sha256}`);
  }

  const idempotencyKey = resumeJobKey(userId, upload.sha256);
  const [job] = await db
    .insert(jobs)
    .values({
      type: "resume_extract",
      userId,
      idempotencyKey,
      payload: {
        fileId,
        storageKey,
        mime: upload.mime,
        sha256: upload.sha256,
        fileName: upload.fileName,
        pipelineVersion: RESUME_PIPELINE_VERSION,
      },
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey })
    .returning({ id: jobs.id });

  let jobId = job?.id;
  if (!jobId) {
    const existingJobs = await db
      .select({ id: jobs.id })
      .from(jobs)
      .where(eq(jobs.idempotencyKey, idempotencyKey));
    const existingJob = existingJobs[0];
    if (!existingJob?.id) {
      throw new Error(`Failed to resolve job ID for resume upload: ${idempotencyKey}`);
    }
    jobId = existingJob.id;
  }

  // The same file again after a failed run (a provider outage, say) is the user's retry:
  // without this they'd get the failed job back, and those bytes could never be read.
  // Only `failed`: needs_review means the file itself was the problem, and a repeat
  // while it's queued or running must not disturb it.
  if (!job) {
    await db
      .update(jobs)
      .set({
        status: "queued",
        attempts: 0,
        runAt: new Date(),
        finishedAt: null,
        lastError: null,
        lockedBy: null,
        lockedUntil: null,
        payload: sql`${jobs.payload} - 'notified_at'`,
      })
      .where(and(eq(jobs.id, jobId), eq(jobs.status, "failed")));
  }

  await db
    .update(onboardingState)
    .set({ resumeUploaded: true, updatedAt: new Date() })
    .where(eq(onboardingState.userId, userId));

  wakeWorker("resume_extract");
  return { jobId };
}
