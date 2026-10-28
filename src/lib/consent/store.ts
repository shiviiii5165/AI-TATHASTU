import "server-only";

import { and, desc, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { db } from "@/db";
import { connections, consents, files, jobs, type ConsentPurpose, type SourceId } from "@/db/schema";
import { CONSENT_POLICY_VERSION, CONSENT_PURPOSES, type ConsentChoices } from "@/lib/consent/catalog";
import { wakeWorker } from "@/lib/worker-ping";

export const consentChoicesSchema = z.object({
  external_ai: z.boolean().default(false),
  linkedin_scrape: z.boolean(),
  analytics: z.boolean(),
  // Added after launch: a page loaded before it existed omits it.
  mentor_discovery: z.boolean().default(false),
}) satisfies z.ZodType<ConsentChoices>;

/** Latest row per purpose; null where the user has never answered ("unset"). */
export async function getCurrentConsents(userId: string) {
  const rows = await db.select().from(consents).where(eq(consents.userId, userId)).orderBy(desc(consents.createdAt));
  const latest: Partial<Record<ConsentPurpose, (typeof rows)[number]>> = {};
  for (const row of rows) latest[row.purpose] ??= row;
  return latest;
}

/**
 * Append-only: inserts a row only for purposes whose answer (or the policy
 * version it was given under) differs from the latest row. Never updates.
 */
export async function appendConsents(userId: string, choices: ConsentChoices) {
  const latest = await getCurrentConsents(userId);
  const changed = CONSENT_PURPOSES.filter((purpose) => {
    const prev = latest[purpose];
    return !prev || prev.granted !== choices[purpose] || prev.policyVersion !== CONSENT_POLICY_VERSION;
  });
  if (changed.length) {
    const newlyGranted = changed.filter((p) => choices[p] && latest[p]?.granted !== true);
    await db.insert(consents).values(
      changed.map((purpose) => ({
        userId,
        purpose,
        granted: choices[purpose],
        policyVersion: CONSENT_POLICY_VERSION,
      })),
    );
    await requeueWaitingSyncs(userId, newlyGranted);
  }
  return { appended: changed };
}

/**
 * One purpose at a time (the resume step's AI toggle, the LinkedIn connect
 * dialog). Append-only, like appendConsents. `requeue: false` when the caller
 * queues its own sync right after, so the source isn't fetched twice.
 */
export async function appendConsent(
  userId: string,
  purpose: ConsentPurpose,
  granted: boolean,
  { requeue = true }: { requeue?: boolean } = {},
) {
  const latest = (await getCurrentConsents(userId))[purpose];
  if (latest && latest.granted === granted && latest.policyVersion === CONSENT_POLICY_VERSION) return;
  await db.insert(consents).values({ userId, purpose, granted, policyVersion: CONSENT_POLICY_VERSION });
  if (requeue && granted && latest?.granted !== true) await requeueWaitingSyncs(userId, [purpose]);
}

// Syncs that skip work without a consent: LinkedIn scraping parks until
// linkedin_scrape; portfolio LLM extraction runs only with external_ai.
const WAITING_ON: Partial<Record<ConsentPurpose, SourceId[]>> = {
  linkedin_scrape: ["linkedin"],
  external_ai: ["portfolio"],
};

async function requeueWaitingSyncs(userId: string, granted: ConsentPurpose[]) {
  // Resume extraction without external_ai used rules only: read the latest upload again with AI.
  if (granted.includes("external_ai")) await requeueResumeExtraction(userId);
  const sources = [...new Set(granted.flatMap((p) => WAITING_ON[p] ?? []))];
  if (!sources.length) return;
  const rows = await db
    .select({ id: connections.id, sourceId: connections.sourceId })
    .from(connections)
    .where(and(eq(connections.userId, userId), inArray(connections.sourceId, sources)));
  if (!rows.length) return;
  await db.insert(jobs).values(
    rows.map((c) => ({
      type: "connector_sync" as const,
      userId,
      idempotencyKey: `connector_sync:${c.id}:consent:${randomUUID()}`,
      payload: { source_id: c.sourceId, connection_id: c.id },
    })),
  );
  wakeWorker("connector_sync:consent");
}

async function requeueResumeExtraction(userId: string) {
  const [file] = await db
    .select()
    .from(files)
    .where(and(eq(files.userId, userId), eq(files.kind, "resume")))
    .orderBy(desc(files.createdAt))
    .limit(1);
  if (!file) return;
  await db.insert(jobs).values({
    type: "resume_extract",
    userId,
    idempotencyKey: `resume_extract:${userId}:${file.sha256}:consent:${randomUUID()}`,
    payload: { fileId: file.id, storageKey: file.storageKey, mime: file.mime, sha256: file.sha256, trigger: "external_ai_granted" },
  });
  wakeWorker("resume_extract:consent");
}
