import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { webhookOutbox, type IntegrationClientId } from "@/db/schema";
import { clientById } from "@/lib/integrations/clients";

/**
 * Catches up linked apps whose copy of a profile is older than the profile itself.
 *
 * profile.updated is normally queued by the worker after compute_intelligence, through a
 * fire-and-forget POST to /api/internal/profile-updated. When that call fails (a secret that
 * differs between Render and Vercel, a redirect, a cold start), nothing records it, and the app
 * keeps the profile it was first sent. This reads the database instead and queues profile.updated
 * when, for a linked and onboarded user:
 *   - no profile.updated was ever delivered,
 *   - a compute_intelligence job, or onboarding, finished after the last delivered row was queued
 *     (queued, not delivered: the payload is built between the two, so this never misses a change;
 *     at worst it re-sends once, which the app dedupes by generatedAt), or
 *   - a later profile.updated failed for good (retries exhausted), so failures recover daily.
 * Delivery, consent filtering, retries and signing stay in webhooks.ts. A pending or sending row
 * already covers the user, so re-running queues nothing new.
 */

export type StaleCause = "never_delivered" | "recomputed_since_delivery" | "onboarded_since_delivery" | "failed_since_delivery";

export type StaleSync = {
  userId: string;
  clientId: IntegrationClientId;
  lastComputedAt: Date | null;
  onboardedAt: Date | null;
  lastDeliveredAt: Date | null;
  cause: StaleCause;
};

const toDate = (v: unknown) => (v == null ? null : new Date(String(v)));

export async function findStaleProfileSyncs(clientId: IntegrationClientId, limit = 500): Promise<StaleSync[]> {
  const result = await db.execute(sql`
    WITH s AS (
      SELECT ic.user_id, o.completed_at AS onboarded_at,
             (SELECT max(j.finished_at) FROM jobs j
               WHERE j.user_id = ic.user_id AND j.type = 'compute_intelligence' AND j.status = 'done') AS last_computed_at,
             d.queued_at AS last_delivered_queued_at, d.delivered_at AS last_delivered_at,
             EXISTS (SELECT 1 FROM webhook_outbox f
                      WHERE f.user_id = ic.user_id AND f.client_id = ic.client_id
                        AND f.event = 'profile.updated' AND f.status = 'failed'
                        AND f.created_at > coalesce(d.queued_at, '-infinity'::timestamptz)) AS failed_since
        FROM integration_consents ic
        JOIN users u ON u.id = ic.user_id AND u.deleted_at IS NULL
        JOIN onboarding_state o ON o.user_id = ic.user_id AND o.current_step = 'done'
        LEFT JOIN LATERAL (
              SELECT w.created_at AS queued_at, w.delivered_at FROM webhook_outbox w
               WHERE w.user_id = ic.user_id AND w.client_id = ic.client_id
                 AND w.event = 'profile.updated' AND w.status = 'delivered'
               ORDER BY w.created_at DESC LIMIT 1) d ON true
       WHERE ic.client_id = ${clientId}
         AND ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL
         AND NOT EXISTS (SELECT 1 FROM webhook_outbox p
                          WHERE p.user_id = ic.user_id AND p.client_id = ic.client_id
                            AND p.event = 'profile.updated' AND p.status IN ('pending', 'sending')))
    SELECT * FROM s
     WHERE last_delivered_queued_at IS NULL
        OR last_computed_at > last_delivered_queued_at
        OR onboarded_at > last_delivered_queued_at
        OR failed_since
     ORDER BY user_id
     LIMIT ${limit}`);

  return (result.rows as Record<string, unknown>[]).map((r) => {
    const queuedAt = toDate(r.last_delivered_queued_at);
    const lastComputedAt = toDate(r.last_computed_at);
    const onboardedAt = toDate(r.onboarded_at);
    const cause: StaleCause = !queuedAt
      ? "never_delivered"
      : lastComputedAt && lastComputedAt > queuedAt
        ? "recomputed_since_delivery"
        : onboardedAt && onboardedAt > queuedAt
          ? "onboarded_since_delivery"
          : "failed_since_delivery";
    return { userId: String(r.user_id), clientId, lastComputedAt, onboardedAt, lastDeliveredAt: toDate(r.last_delivered_at), cause };
  });
}

export function countByCause(stale: StaleSync[]) {
  const counts: Partial<Record<StaleCause, number>> = {};
  for (const s of stale) counts[s.cause] = (counts[s.cause] ?? 0) + 1;
  return counts;
}

/**
 * Queues profile.updated (reason "reconcile") for every stale sync. With apply=false, only reports.
 * Does nothing for an app without a configured webhook (it would never be delivered).
 */
export async function reconcileProfileSyncs(clientId: IntegrationClientId, { apply = true, limit = 500 } = {}) {
  const client = clientById(clientId);
  if (!client?.webhookUrl || !client.webhookSecret) {
    return { clientId, stale: [] as StaleSync[], byCause: countByCause([]), queued: 0, skipped: "webhook_not_configured" as const };
  }
  const stale = await findStaleProfileSyncs(clientId, limit);
  const byCause = countByCause(stale);
  if (!apply || !stale.length) return { clientId, stale, byCause, queued: 0 };
  // The partial unique index (one pending row per app/user/event) makes a concurrent run a no-op.
  const inserted = await db
    .insert(webhookOutbox)
    .values(stale.map((s) => ({ clientId, userId: s.userId, event: "profile.updated" as const, reason: "reconcile" })))
    .onConflictDoNothing()
    .returning({ id: webhookOutbox.id });
  // Not silent: recomputed profiles that never reached the app mean the worker's callback is failing.
  if (byCause.recomputed_since_delivery) {
    console.warn(
      `[profile-sync] ${clientId}: ${byCause.recomputed_since_delivery} recomputed profile(s) had not been sent; ` +
        "check the worker's INTERNAL_API_SECRET and APP_URL (POST /api/internal/profile-updated).",
    );
  }
  return { clientId, stale, byCause, queued: inserted.length };
}
