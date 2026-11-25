import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { CONSENT_POLICY_VERSION } from "@/lib/integrations/consent";
import type { AutoProvisionClient } from "@/lib/integrations/auto-provision";

/**
 * Where every AI Tathastu account stands with one app, for the backfill preview and the final reconciliation.
 * Counts only: no ids, emails or profile data. Every account lands in exactly one bucket, so the buckets sum to
 * `total`. Read-only.
 *
 *   deleted              account deleted on AI Tathastu: never provisioned (skipped)
 *   eligible             active, not yet linked on the current policy: the backfill would provision it
 *   alreadySynced        linked and the app confirmed the latest profile
 *   inFlight             linked, an event is queued or being sent
 *   onboardingIncomplete linked, nothing confirmed yet, onboarding not finished (`--send` skips these; the
 *                        scheduled dispatch sends them)
 *   failed               linked, retries ran out, the app rejected it, or it reported no profile (`repair` retries)
 *   conflict             linked, an existing account there needs its owner or an admin
 *   unconfirmed          linked, nothing queued and no confirmation yet (`repair` re-sends: no_state / stuck)
 */
export type BackfillReport = {
  client: AutoProvisionClient;
  total: number;
  deleted: number;
  eligible: number;
  alreadySynced: number;
  inFlight: number;
  onboardingIncomplete: number;
  failed: number;
  conflict: number;
  unconfirmed: number;
};

export async function backfillReport(client: AutoProvisionClient): Promise<BackfillReport> {
  const result = await db.execute(sql`
    WITH b AS (
      SELECT CASE
               WHEN u.deleted_at IS NOT NULL THEN 'deleted'
               WHEN ic.user_id IS NULL OR ic.linked_at IS NULL OR ic.revoked_at IS NOT NULL
                    OR ic.policy_version IS DISTINCT FROM ${CONSENT_POLICY_VERSION} THEN 'eligible'
               WHEN s.status = 'synced' THEN 'alreadySynced'
               WHEN EXISTS (SELECT 1 FROM webhook_outbox w WHERE w.user_id = u.id AND w.client_id = ${client}
                              AND w.status IN ('pending', 'sending')) THEN 'inFlight'
               WHEN s.status IN ('failed', 'missing') THEN 'failed'
               WHEN s.status IN ('conflict', 'review') THEN 'conflict'
               WHEN coalesce(o.current_step, '') <> 'done' THEN 'onboardingIncomplete'
               ELSE 'unconfirmed'
             END AS bucket
        FROM users u
        LEFT JOIN integration_consents ic ON ic.user_id = u.id AND ic.client_id = ${client}
        LEFT JOIN integration_sync_state s ON s.user_id = u.id AND s.client_id = ${client}
        LEFT JOIN onboarding_state o ON o.user_id = u.id)
    SELECT bucket, count(*)::int AS n FROM b GROUP BY bucket`);
  const report: BackfillReport = { client, total: 0, deleted: 0, eligible: 0, alreadySynced: 0, inFlight: 0, onboardingIncomplete: 0, failed: 0, conflict: 0, unconfirmed: 0 };
  for (const r of result.rows as { bucket: Exclude<keyof BackfillReport, "client" | "total">; n: number }[]) {
    report[r.bucket] = Number(r.n);
    report.total += Number(r.n);
  }
  return report;
}
