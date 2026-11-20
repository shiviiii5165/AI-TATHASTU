import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import type { SyncStatus } from "@/db/schema";
import { AUTO_PROVISION_CLIENTS, type AutoProvisionClient, autoProvisionEnabled, backfillEnabled } from "@/lib/integrations/auto-provision";
import { clientById } from "@/lib/integrations/clients";

/** Per-app profile-sync figures for Admin → Intelligence → Integrations. Counts only; no personal data. */
export type AppSyncSummary = {
  clientId: AutoProvisionClient;
  name: string;
  signupProvisioning: boolean;
  backfillJob: boolean;
  webhookConfigured: boolean;
  eligible: number; // active accounts
  linked: number; // consent given and not revoked
  noChoice: number; // backfill candidates: never chose for this app
  byStatus: Partial<Record<SyncStatus, number>>;
  linkedWithoutStatus: number;
  pendingRetries: number; // queued rows that already failed at least once
  failedEvents30d: number;
  deletionsPending: number; // integration.revoked (account_deleted) not yet confirmed
  deletionsConfirmed30d: number;
};

export async function appSyncSummaries(): Promise<AppSyncSummary[]> {
  const out: AppSyncSummary[] = [];
  for (const clientId of AUTO_PROVISION_CLIENTS) {
    const client = clientById(clientId)!;
    const { rows } = await db.execute(sql`
      SELECT
        (SELECT count(*) FROM users WHERE deleted_at IS NULL)::int AS eligible,
        (SELECT count(*) FROM integration_consents ic JOIN users u ON u.id = ic.user_id AND u.deleted_at IS NULL
          WHERE ic.client_id = ${clientId} AND ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL)::int AS linked,
        (SELECT count(*) FROM users u WHERE u.deleted_at IS NULL AND NOT EXISTS
          (SELECT 1 FROM integration_consents ic WHERE ic.user_id = u.id AND ic.client_id = ${clientId}))::int AS no_choice,
        (SELECT count(*) FROM integration_consents ic JOIN users u ON u.id = ic.user_id AND u.deleted_at IS NULL
          WHERE ic.client_id = ${clientId} AND ic.linked_at IS NOT NULL AND ic.revoked_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM integration_sync_state s WHERE s.user_id = ic.user_id AND s.client_id = ic.client_id))::int AS no_status,
        (SELECT count(*) FROM webhook_outbox WHERE client_id = ${clientId} AND status = 'pending' AND attempts > 0)::int AS retries,
        (SELECT count(*) FROM webhook_outbox WHERE client_id = ${clientId} AND status = 'failed' AND created_at > now() - interval '30 days')::int AS failed,
        (SELECT count(*) FROM webhook_outbox WHERE client_id = ${clientId} AND event = 'integration.revoked' AND reason = 'account_deleted'
            AND status IN ('pending', 'sending'))::int AS del_pending,
        (SELECT count(*) FROM integration_sync_state WHERE client_id = ${clientId} AND status = 'deleted'
            AND updated_at > now() - interval '30 days')::int AS del_done`);
    const r = rows[0] as Record<string, number>;
    const { rows: statusRows } = await db.execute(sql`
      SELECT s.status, count(*)::int AS n FROM integration_sync_state s
        LEFT JOIN users u ON u.id = s.user_id
       WHERE s.client_id = ${clientId} AND (u.deleted_at IS NULL OR s.status = 'deleted')
       GROUP BY s.status`);
    out.push({
      clientId,
      name: client.name,
      signupProvisioning: autoProvisionEnabled(clientId),
      backfillJob: backfillEnabled(clientId),
      webhookConfigured: Boolean(client.webhookUrl && client.webhookSecret),
      eligible: r.eligible,
      linked: r.linked,
      noChoice: r.no_choice,
      byStatus: Object.fromEntries((statusRows as { status: SyncStatus; n: number }[]).map((s) => [s.status, s.n])),
      linkedWithoutStatus: r.no_status,
      pendingRetries: r.retries,
      failedEvents30d: r.failed,
      deletionsPending: r.del_pending,
      deletionsConfirmed30d: r.del_done,
    });
  }
  return out;
}
