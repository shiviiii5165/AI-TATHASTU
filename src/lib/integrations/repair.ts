import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { IntegrationClientId } from "@/db/schema";
import { markSyncPending } from "@/lib/integrations/sync-state";
import { enqueueProfileUpdated } from "@/lib/integrations/webhooks";

/**
 * Missing-profile repair for linked apps.
 *
 * A user is a candidate when their account is active, the app is linked (consent given, not revoked), no event for
 * them is already queued or being sent, and the app has not confirmed a profile:
 *   no_state        never sent anything we have a status for (e.g. linked before statuses existed)
 *   missing         the app answered "ignored": it has no profile for this id
 *   failed          retries ran out, or the app rejected the event
 *   stuck_pending   shown as pending for over an hour with nothing queued
 *   conflict_recheck a conflict older than 7 days (the owner may have linked since), re-checked once a week
 * Repair queues profile.updated with reason "auto_provision": the receivers create the profile if it is missing and
 * otherwise apply it as an ordinary update, so re-running is harmless. It never changes consent.
 */
export type RepairCause = "no_state" | "missing" | "failed" | "stuck_pending" | "conflict_recheck";
export type RepairCandidate = { userId: string; cause: RepairCause };

export async function findRepairCandidates(clientId: IntegrationClientId, limit = 100, userIds?: string[]): Promise<RepairCandidate[]> {
  const only = userIds?.length ? sql`AND ic.user_id IN (${sql.join(userIds.map((id) => sql`${id}::uuid`), sql`, `)})` : sql``;
  const result = await db.execute(sql`
    SELECT ic.user_id::text AS user_id,
           CASE
             WHEN s.user_id IS NULL THEN 'no_state'
             WHEN s.status = 'missing' THEN 'missing'
             WHEN s.status = 'failed' THEN 'failed'
             WHEN s.status = 'pending' THEN 'stuck_pending'
             ELSE 'conflict_recheck'
           END AS cause
      FROM integration_consents ic
      JOIN users u ON u.id = ic.user_id AND u.deleted_at IS NULL
      LEFT JOIN integration_sync_state s ON s.user_id = ic.user_id AND s.client_id = ic.client_id
     WHERE ic.client_id = ${clientId}
       AND ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM webhook_outbox w
                        WHERE w.user_id = ic.user_id AND w.client_id = ic.client_id AND w.status IN ('pending', 'sending'))
       AND (s.user_id IS NULL
            OR s.status IN ('missing', 'failed')
            OR (s.status = 'pending' AND s.updated_at < now() - interval '1 hour')
            OR (s.status IN ('conflict', 'review') AND s.updated_at < now() - interval '7 days'))
       ${only}
     ORDER BY u.created_at
     LIMIT ${limit}`);
  return (result.rows as Record<string, unknown>[]).map((r) => ({ userId: String(r.user_id), cause: r.cause as RepairCause }));
}

export type RepairResult = { dryRun: boolean; candidates: RepairCandidate[]; queued: number };

/** Queues repair for the candidates (apply) or only reports them. Bounded by `limit`. */
export async function repairMissingProfiles(
  clientId: IntegrationClientId,
  { apply = false, limit = 100, userIds }: { apply?: boolean; limit?: number; userIds?: string[] } = {},
): Promise<RepairResult> {
  const candidates = await findRepairCandidates(clientId, limit, userIds);
  if (!apply) return { dryRun: true, candidates, queued: 0 };
  let queued = 0;
  for (const c of candidates) {
    const targets = await enqueueProfileUpdated(c.userId, "auto_provision", clientId);
    if (targets.length) {
      // A conflict re-check shows as pending again until the app answers.
      if (c.cause === "conflict_recheck") await markSyncPending(c.userId, clientId, "profile.updated", { force: true });
      queued++;
    }
  }
  return { dryRun: false, candidates, queued };
}
