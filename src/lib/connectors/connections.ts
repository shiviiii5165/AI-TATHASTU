import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { accounts, connections, jobs, onboardingState, profileFacts, type AccessMethod, type SourceId } from "@/db/schema";
import { credentialAad, open, seal } from "@/lib/connectors/crypto";
import { sourceById } from "@/lib/connectors/sources";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * Stores (or replaces) the user's connection to a source and queues its first
 * sync. `credential` is sealed into token_enc; `syncKey` makes the job
 * idempotent per connect attempt (an OAuth state, a form submission id).
 */
export async function connectSource(input: {
  userId: string;
  sourceId: SourceId;
  accessMethod: AccessMethod;
  credential: Record<string, unknown> | null;
  syncKey: string;
  queueSync?: boolean;
  // Don't replace an existing connection (LinkedIn sign-in must not wipe a scrape URL).
  keepExisting?: boolean;
}) {
  const tokenEnc = input.credential ? seal(input.credential, credentialAad(input.userId, input.sourceId)) : null;

  if (input.keepExisting) {
    const [existing] = await db
      .select({ id: connections.id })
      .from(connections)
      .where(and(eq(connections.userId, input.userId), eq(connections.sourceId, input.sourceId)));
    if (existing) return { connectionId: existing.id };
  }

  const [connection] = await db
    .insert(connections)
    .values({
      userId: input.userId,
      sourceId: input.sourceId,
      accessMethod: input.accessMethod,
      tokenEnc,
      status: "connected",
    })
    .onConflictDoUpdate({
      target: [connections.userId, connections.sourceId],
      set: { accessMethod: input.accessMethod, tokenEnc, status: "connected", lastSyncAt: null, staleAfter: null },
    })
    .returning({ id: connections.id });

  await db.batch([
    db
      .update(onboardingState)
      .set({
        connectorsStatus: sql`${onboardingState.connectorsStatus} || jsonb_build_object(${input.sourceId}::text, 'connected')`,
        updatedAt: new Date(),
      })
      .where(eq(onboardingState.userId, input.userId)),
    ...(input.queueSync === false
      ? []
      : [
          db
            .insert(jobs)
            .values({
              type: "connector_sync",
              userId: input.userId,
              idempotencyKey: `connector_sync:${connection.id}:${input.syncKey}`,
              payload: { source_id: input.sourceId, connection_id: connection.id },
            })
            .onConflictDoNothing({ target: jobs.idempotencyKey }),
        ]),
  ]);

  if (input.queueSync !== false) wakeWorker(`connector_sync:${input.sourceId}`);
  return { connectionId: connection.id };
}

/**
 * "Disconnect and delete": removes the connection, cancels its pending syncs
 * and deletes every fact that came from that source.
 */
export async function disconnectSource(userId: string, sourceId: SourceId) {
  const [connection] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.sourceId, sourceId)));
  const origins = sourceById(sourceId)?.origins ?? [];

  await db.batch([
    db
      .update(jobs)
      .set({ status: "failed", lastError: "Cancelled: source disconnected", finishedAt: new Date() })
      .where(
        and(
          eq(jobs.userId, userId),
          eq(jobs.type, "connector_sync"),
          eq(jobs.status, "queued"),
          sql`${jobs.payload}->>'source_id' = ${sourceId}`,
        ),
      ),
    db.delete(connections).where(and(eq(connections.userId, userId), eq(connections.sourceId, sourceId))),
    ...(origins.length
      ? [db.delete(profileFacts).where(and(eq(profileFacts.userId, userId), inArray(profileFacts.origin, origins)))]
      : []),
    ...(sourceId === "linkedin"
      ? [db.delete(accounts).where(and(eq(accounts.userId, userId), eq(accounts.provider, "linkedin")))]
      : []),
    db
      .update(onboardingState)
      .set({ connectorsStatus: sql`${onboardingState.connectorsStatus} - ${sourceId}::text`, updatedAt: new Date() })
      .where(eq(onboardingState.userId, userId)),
  ]);

  return connection ?? null;
}

export function openCredential<T>(userId: string, sourceId: SourceId, tokenEnc: Buffer | null): T | null {
  if (!tokenEnc) return null;
  try {
    return open<T>(tokenEnc, credentialAad(userId, sourceId));
  } catch {
    return null;
  }
}
