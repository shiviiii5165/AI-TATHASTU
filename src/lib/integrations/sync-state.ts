import "server-only";

import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { integrationSyncState, type IntegrationClientId, type SyncStatus, type WebhookEvent } from "@/db/schema";

/**
 * The shared answer vocabulary of the receiving apps (Collaborate tathastu-sso.ts, Avsar ait-webhooks.ts).
 * A 2xx without one of these (an older receiver) is "unconfirmed": never shown as synced.
 */
export const SYNC_OUTCOMES = [
  "created", "updated", "up_to_date", "deleted", "unlinked", "ignored", "ignored_consent",
  "conflict", "invalid_identity", "rejected", "retryable",
] as const;
export type SyncOutcome = (typeof SYNC_OUTCOMES)[number] | "unconfirmed";

export const parseOutcome = (value: unknown): SyncOutcome =>
  typeof value === "string" && (SYNC_OUTCOMES as readonly string[]).includes(value) ? (value as SyncOutcome) : "unconfirmed";

/** Outcomes after which the event is done (no retry). Everything else is retried with backoff. */
export const isFinalOutcome = (o: SyncOutcome) => o !== "retryable";

/** States a routine update must not hide: they stay until the user, an admin or repair resolves them. */
const STICKY: SyncStatus[] = ["conflict", "review", "declined"];

/**
 * What the user and admins see after the app answered. `action` is the app's detailed code, used only to tell a
 * conflict the owner can resolve (link with their password) from one that needs an admin.
 */
export function statusFor(event: WebhookEvent, outcome: SyncOutcome, reason: string | null, action?: string | null): SyncStatus | null {
  if (event === "integration.revoked") {
    if (outcome === "deleted") return "deleted";
    if (outcome === "unlinked" || outcome === "ignored" || outcome === "up_to_date") return reason === "account_deleted" ? "deleted" : "unlinked";
    if (outcome === "invalid_identity" || outcome === "rejected") return "failed";
    return null; // retryable / unconfirmed: unchanged until final
  }
  switch (outcome) {
    case "created":
    case "updated":
    case "up_to_date":
      return "synced";
    case "ignored":
      return "missing"; // the app has no profile for this user: repair provisions it
    case "ignored_consent":
      return "declined";
    case "conflict":
      return action === "CONFLICT_NEEDS_REVIEW" ? "review" : "conflict";
    case "invalid_identity":
    case "rejected":
      return "failed";
    default:
      return null;
  }
}

/** Something was queued for this app: "pending", unless a state that needs attention is showing. */
export async function markSyncPending(userId: string, clientId: IntegrationClientId, event: WebhookEvent, { force = false } = {}) {
  const now = new Date();
  await db
    .insert(integrationSyncState)
    .values({ userId, clientId, status: "pending", lastEvent: event, updatedAt: now })
    .onConflictDoUpdate({
      target: [integrationSyncState.userId, integrationSyncState.clientId],
      set: { status: "pending", lastEvent: event, updatedAt: now },
      ...(force ? {} : { setWhere: notInArray(integrationSyncState.status, STICKY) }),
    });
}

/** Records the app's answer (or a final delivery failure) for one event. */
export async function recordSyncResult(
  userId: string,
  clientId: IntegrationClientId,
  event: WebhookEvent,
  result: { outcome: SyncOutcome | "delivery_failed"; reason: string | null; action?: string | null },
) {
  const now = new Date();
  const status: SyncStatus | null = result.outcome === "delivery_failed" ? "failed" : statusFor(event, result.outcome, result.reason, result.action);
  const success = status === "synced" || status === "deleted" || status === "unlinked";
  await db
    .insert(integrationSyncState)
    .values({
      userId,
      clientId,
      status: status ?? "pending",
      lastOutcome: result.outcome,
      lastEvent: event,
      lastAttemptAt: now,
      lastSuccessAt: success ? now : null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [integrationSyncState.userId, integrationSyncState.clientId],
      set: {
        ...(status ? { status } : {}),
        lastOutcome: result.outcome,
        lastEvent: event,
        lastAttemptAt: now,
        ...(success ? { lastSuccessAt: now } : {}),
        updatedAt: now,
      },
    });
}

export async function getSyncStates(userId: string) {
  const rows = await db.select().from(integrationSyncState).where(eq(integrationSyncState.userId, userId));
  return new Map(rows.map((r) => [r.clientId, r]));
}

/** Counts per app and status, for the admin view. */
export async function syncStatusCounts(clientIds: IntegrationClientId[]) {
  if (!clientIds.length) return [];
  return db
    .select({ clientId: integrationSyncState.clientId, status: integrationSyncState.status, n: sql<number>`count(*)::int` })
    .from(integrationSyncState)
    .where(and(inArray(integrationSyncState.clientId, clientIds)))
    .groupBy(integrationSyncState.clientId, integrationSyncState.status);
}
