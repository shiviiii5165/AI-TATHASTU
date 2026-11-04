import "server-only";

import { createHmac } from "node:crypto";

import { and, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  integrationConsents,
  webhookOutbox,
  type IntegrationClientId,
  type WebhookEvent,
  type WebhookOutboxRow,
} from "@/db/schema";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { clientById } from "@/lib/integrations/clients";
import { getConsent, isLinked } from "@/lib/integrations/consent";
import { toProfessionalProjectionV1 } from "@/lib/integrations/projection";
import { loadProfile } from "@/lib/profile/unified";

/**
 * Webhooks to integrated apps, through the webhook_outbox table:
 *
 *  - enqueue*() records that an app must hear about a user. One pending row
 *    per (app, user, event): bursts of changes coalesce into it.
 *  - dispatchWebhooks() claims due rows, builds the payload at send time
 *    (latest profile, current consent) and POSTs it, signed:
 *      X-AIT-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>
 *    2xx = delivered; otherwise retried with backoff, then marked failed.
 *
 * Runs after the request that enqueued (after()), when the worker reports a
 * recomputed profile, from the "Sync profile" button, and from the daily
 * cron, which also picks up retries. Delivery is at-least-once: apps dedupe
 * on the event id (X-AIT-Delivery).
 */

const BACKOFF_SECONDS = [60, 5 * 60, 30 * 60, 2 * 3600, 12 * 3600];
const MAX_ATTEMPTS = BACKOFF_SECONDS.length + 1;
const SEND_TIMEOUT_MS = 10_000;
const LOCK_SECONDS = 60;

export type DispatchResult = { delivered: number; retrying: number; failed: number };

export function signWebhook(secret: string, body: string, timestamp = Math.floor(Date.now() / 1000)) {
  const v1 = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return { header: `t=${timestamp},v1=${v1}`, timestamp };
}

const webhookReady = (id: IntegrationClientId) => {
  const c = clientById(id);
  return Boolean(c?.webhookUrl && c.webhookSecret);
};

/** profile.updated for every app this user has linked (and that has a webhook). Returns the apps queued. */
export async function enqueueProfileUpdated(userId: string, reason: string, only?: IntegrationClientId) {
  const linked = await db
    .select({ clientId: integrationConsents.clientId })
    .from(integrationConsents)
    .where(
      and(
        eq(integrationConsents.userId, userId),
        isNotNull(integrationConsents.linkedAt),
        isNull(integrationConsents.revokedAt),
        only ? eq(integrationConsents.clientId, only) : undefined,
      ),
    );
  const targets = linked.map((l) => l.clientId).filter(webhookReady);
  if (targets.length) {
    await db
      .insert(webhookOutbox)
      .values(targets.map((clientId) => ({ clientId, userId, event: "profile.updated" as const, reason })))
      .onConflictDoNothing();
  }
  return targets;
}

/** integration.revoked, so the app deletes what it stored. Call before or after revoking. */
export async function enqueueRevoked(userId: string, clientId: IntegrationClientId, reason = "user_disconnected") {
  if (!webhookReady(clientId)) return false;
  await db
    .insert(webhookOutbox)
    .values({ clientId, userId, event: "integration.revoked", reason })
    .onConflictDoNothing();
  return true;
}

/** Every app the user linked hears integration.revoked. Returns apps with no webhook to call. */
export async function enqueueRevokedForDeletion(userId: string) {
  const linked = await db
    .select({ clientId: integrationConsents.clientId })
    .from(integrationConsents)
    .where(and(eq(integrationConsents.userId, userId), isNotNull(integrationConsents.linkedAt), isNull(integrationConsents.revokedAt)));
  const unreachable: IntegrationClientId[] = [];
  for (const { clientId } of linked) {
    if (!(await enqueueRevoked(userId, clientId, "account_deleted"))) unreachable.push(clientId);
  }
  return unreachable;
}

async function claimDue(limit: number): Promise<WebhookOutboxRow[]> {
  // One statement, so it's atomic on neon-http too; SKIP LOCKED lets dispatchers overlap.
  const result = await db.execute(sql`
    UPDATE webhook_outbox
       SET status = 'sending', attempts = attempts + 1,
           locked_until = now() + make_interval(secs => ${LOCK_SECONDS})
     WHERE id IN (
           SELECT id FROM webhook_outbox
            WHERE (status = 'pending' AND next_attempt_at <= now())
               OR (status = 'sending' AND locked_until < now())
            ORDER BY next_attempt_at
            LIMIT ${limit}
            FOR UPDATE SKIP LOCKED)
 RETURNING id, client_id, user_id, event, reason, attempts`);
  return (result.rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    clientId: r.client_id as IntegrationClientId,
    userId: String(r.user_id),
    event: r.event as WebhookEvent,
    reason: (r.reason as string | null) ?? null,
    attempts: Number(r.attempts),
  })) as WebhookOutboxRow[];
}

async function payloadFor(row: WebhookOutboxRow) {
  const base = { id: row.id, type: row.event, createdAt: new Date().toISOString() };
  if (row.event === "integration.revoked") return { ...base, data: { userId: row.userId } };

  const consent = await getConsent(row.userId, row.clientId);
  if (!isLinked(consent)) return null; // unlinked since it was queued
  const profile = toProfessionalProjectionV1(await loadProfile(row.userId), row.clientId, consent);
  return { ...base, data: { userId: row.userId, reason: row.reason, profile } };
}

async function deliver(row: WebhookOutboxRow): Promise<"delivered" | "retrying" | "failed"> {
  const client = clientById(row.clientId);
  let error: string;
  try {
    if (!client?.webhookUrl || !client.webhookSecret) throw new Error("webhook not configured");
    if (!(await isFeatureEnabled(client.flag))) throw new Error(`${client.flag} is off`);
    const payload = await payloadFor(row);
    if (!payload) {
      await finish(row.id, "failed", "app is no longer linked");
      return "failed";
    }
    const body = JSON.stringify(payload);
    const { header } = signWebhook(client.webhookSecret, body);
    const res = await fetch(client.webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AI-Tathastu-Webhooks/1",
        "X-AIT-Event": row.event,
        "X-AIT-Delivery": row.id,
        "X-AIT-Signature": header,
      },
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    });
    if (res.ok) {
      await finish(row.id, "delivered", null);
      return "delivered";
    }
    error = `HTTP ${res.status}`;
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (row.attempts >= MAX_ATTEMPTS) {
    await finish(row.id, "failed", error);
    return "failed";
  }
  // A newer pending row for the same app/user/event already covers this one.
  const [newer] = await db
    .select({ id: webhookOutbox.id })
    .from(webhookOutbox)
    .where(
      and(
        eq(webhookOutbox.clientId, row.clientId),
        eq(webhookOutbox.userId, row.userId),
        eq(webhookOutbox.event, row.event),
        eq(webhookOutbox.status, "pending"),
        ne(webhookOutbox.id, row.id),
      ),
    );
  if (newer) {
    await finish(row.id, "failed", `${error}; superseded by ${newer.id}`);
    return "failed";
  }
  const delay = BACKOFF_SECONDS[row.attempts - 1];
  await db
    .update(webhookOutbox)
    .set({ status: "pending", lockedUntil: null, lastError: error, nextAttemptAt: sql`now() + make_interval(secs => ${delay})` })
    .where(eq(webhookOutbox.id, row.id));
  return "retrying";
}

async function finish(id: string, status: "delivered" | "failed", lastError: string | null) {
  await db
    .update(webhookOutbox)
    .set({ status, lastError, lockedUntil: null, deliveredAt: status === "delivered" ? new Date() : null })
    .where(eq(webhookOutbox.id, id));
}

export async function dispatchWebhooks(limit = 25): Promise<DispatchResult> {
  const result: DispatchResult = { delivered: 0, retrying: 0, failed: 0 };
  const rows = await claimDue(limit);
  for (const row of rows) result[await deliver(row)]++;
  return result;
}

