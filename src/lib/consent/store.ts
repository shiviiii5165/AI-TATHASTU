import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { connections, consents, files, jobs, type ConsentPurpose, type SourceId } from "@/db/schema";
import { CONSENT_POLICY_VERSION, CONSENT_PURPOSES, type ConsentChoices } from "@/lib/consent/catalog";
import { allowPaidWork } from "@/lib/paid-work";
import { RESUME_PIPELINE_VERSION } from "@/lib/uploads/resume";
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
 *
 * A withdrawal is always recorded, whatever any limit says. Only new grants can be
 * refused; they come back in `refused`, and that purpose keeps its previous answer.
 */
export async function appendConsents(userId: string, choices: ConsentChoices) {
  const latest = await getCurrentConsents(userId);
  const changed = CONSENT_PURPOSES.filter((purpose) => {
    const prev = latest[purpose];
    return !prev || prev.granted !== choices[purpose] || prev.policyVersion !== CONSENT_POLICY_VERSION;
  });
  const newlyGranted = changed.filter((p) => choices[p] && latest[p]?.granted !== true);
  const refused = newlyGranted.length && !(await allowPaidWork(userId, "consent_grant")).ok ? newlyGranted : [];
  const recorded = changed.filter((p) => !refused.includes(p));
  if (recorded.length) {
    await db.insert(consents).values(
      recorded.map((purpose) => ({
        userId,
        purpose,
        granted: choices[purpose],
        policyVersion: CONSENT_POLICY_VERSION,
      })),
    );
    await requeueWaitingSyncs(userId, newlyGranted.filter((p) => !refused.includes(p)));
  }
  return { appended: recorded, refused };
}

/**
 * One purpose at a time (the resume step's AI toggle, the LinkedIn connect
 * dialog). Append-only, like appendConsents. `requeue: false` when the caller
 * queues its own sync right after, so the source isn't fetched twice.
 * False when a new grant was refused; a withdrawal always goes through.
 */
export async function appendConsent(
  userId: string,
  purpose: ConsentPurpose,
  granted: boolean,
  { requeue = true }: { requeue?: boolean } = {},
) {
  const latest = (await getCurrentConsents(userId))[purpose];
  if (latest && latest.granted === granted && latest.policyVersion === CONSENT_POLICY_VERSION) return true;
  const newGrant = granted && latest?.granted !== true;
  if (newGrant && !(await allowPaidWork(userId, "consent_grant")).ok) return false;
  await db.insert(consents).values({ userId, purpose, granted, policyVersion: CONSENT_POLICY_VERSION });
  if (requeue && newGrant) await requeueWaitingSyncs(userId, [purpose]);
  return true;
}

// Syncs that skip work without a consent: LinkedIn scraping parks until
// linkedin_scrape; portfolio LLM extraction runs only with external_ai.
const WAITING_ON: Partial<Record<ConsentPurpose, SourceId[]>> = {
  linkedin_scrape: ["linkedin"],
  external_ai: ["portfolio"],
};

const utcDay = () => new Date().toISOString().slice(0, 10);

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
  // At most one per connection per day however often consent is toggled, even in parallel:
  // the key is deterministic, so a repeat is a no-op rather than another paid fetch.
  await db
    .insert(jobs)
    .values(
      rows.map((c) => ({
        type: "connector_sync" as const,
        userId,
        idempotencyKey: `connector_sync:${c.id}:consent:${utcDay()}`,
        payload: { source_id: c.sourceId, connection_id: c.id },
      })),
    )
    .onConflictDoNothing({ target: jobs.idempotencyKey });
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
  // One AI re-read per file, ever, so toggling can't buy more. If it failed (a provider
  // outage, say) the next grant may try again, within the daily extraction limit.
  const retryable = await db
    .insert(jobs)
    .values({
      type: "resume_extract",
      userId,
      idempotencyKey: `resume_extract:${userId}:${file.sha256}:ai_reread:v${RESUME_PIPELINE_VERSION}`,
      payload: { fileId: file.id, storageKey: file.storageKey, mime: file.mime, sha256: file.sha256, trigger: "external_ai_granted" },
    })
    .onConflictDoUpdate({
      target: jobs.idempotencyKey,
      set: { status: "queued", attempts: 0, runAt: new Date(), finishedAt: null, lastError: null, lockedBy: null, lockedUntil: null, payload: sql`${jobs.payload} - 'notified_at'` },
      where: sql`${jobs.status} = 'failed' AND ${jobs.lastError} IS DISTINCT FROM 'Account deleted'`,
    })
    .returning({ id: jobs.id });
  if (retryable.length) wakeWorker("resume_extract:consent");
}
