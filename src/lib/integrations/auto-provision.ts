import "server-only";

import { and, eq, isNull, lt, notExists, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { connections, integrationConsents, users } from "@/db/schema";
import { queueConnectorSync } from "@/lib/connectors/connections";
import { SCOPE_IDS } from "@/lib/integrations/clients";
import { getConsent, saveConsent, type ScopeMap } from "@/lib/integrations/consent";
import { enqueueProfileUpdated } from "@/lib/integrations/webhooks";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * Automatic Collaborate profiles (owner decision 2026-11-05).
 *
 * Every AI Tathastu user gets a Collaborate profile without a consent screen. Collaborate
 * keeps it PRIVATE (not in discovery, search or recommendations, and the profile page hidden)
 * until the user turns on visibility there. Rules:
 *  - Only users with NO saved Collaborate choice are provisioned. A user who declined,
 *    chose specific sections, or disconnected is never overridden.
 *  - Turned on with COLLABORATE_AUTO_PROVISION=1. Without it nothing happens.
 *  - The consent row is the normal one (linked, all sections), so the existing projection,
 *    webhook and revocation machinery applies unchanged. Disconnecting removes it as usual.
 */
export const autoProvisionEnabled = () => process.env.COLLABORATE_AUTO_PROVISION === "1";

const ALL_SCOPES = Object.fromEntries(SCOPE_IDS.map((s) => [s, true])) as ScopeMap;

/** Links one user to Collaborate if they have never made a choice. Returns true if provisioned. */
export async function autoProvisionCollaborate(userId: string): Promise<boolean> {
  if (!autoProvisionEnabled()) return false;
  if (await getConsent(userId, "collaborate")) return false; // an explicit choice exists: respect it
  await saveConsent(userId, "collaborate", { scopes: ALL_SCOPES, link: true });
  await enqueueProfileUpdated(userId, "auto_provision", "collaborate");
  return true;
}

/** Existing users who have never made a Collaborate choice. Bounded per run. */
export async function provisionPendingUsers(limit = 200): Promise<number> {
  if (!autoProvisionEnabled()) return 0;
  const pending = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        notExists(
          db
            .select({ one: sql`1` })
            .from(integrationConsents)
            .where(and(eq(integrationConsents.userId, users.id), eq(integrationConsents.clientId, "collaborate"))),
        ),
      ),
    )
    .limit(limit);
  let provisioned = 0;
  for (const u of pending) if (await autoProvisionCollaborate(u.id)) provisioned++;
  return provisioned;
}

/** ISO year-week, e.g. 2026-W45: one weekly sync per connection per week (idempotency key). */
export function isoWeek(d = new Date()) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Weekly refresh: re-sync every connected source not synced in the last 6 days (GitHub repos and
 * languages, LeetCode/HackerRank, Kaggle, Stack Exchange, ORCID, portfolio; LinkedIn only where
 * its scrape consent exists, which the worker enforces). The worker recomputes the profile and
 * queues profile.updated, so Collaborate receives the fresh data.
 */
export async function queueWeeklyRefresh(limit = 500): Promise<number> {
  const cutoff = new Date(Date.now() - 6 * 24 * 3600_000);
  const due = await db
    .select({ id: connections.id, userId: connections.userId, sourceId: connections.sourceId })
    .from(connections)
    .innerJoin(users, eq(users.id, connections.userId))
    .where(
      and(
        isNull(users.deletedAt),
        sql`${connections.status} <> 'reauth_needed'`,
        or(isNull(connections.lastSyncAt), lt(connections.lastSyncAt, cutoff)),
      ),
    )
    .limit(limit);
  const week = isoWeek();
  for (const c of due) await queueConnectorSync(c.userId, c.id, c.sourceId, `weekly:${week}`);
  if (due.length) wakeWorker("connector_sync:weekly");
  return due.length;
}
