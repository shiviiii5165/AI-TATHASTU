import "server-only";

import { and, eq, isNull, lt, notExists, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { connections, integrationConsents, users, type ConsentSource, type IntegrationClientId } from "@/db/schema";
import { queueConnectorSync } from "@/lib/connectors/connections";
import { getConsent, saveConsent, DEFAULT_SHARED_SCOPES } from "@/lib/integrations/consent";
import { markSyncPending } from "@/lib/integrations/sync-state";
import { enqueueProfileUpdated } from "@/lib/integrations/webhooks";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * Automatic private profiles in the connected apps (Collaborate: owner decision 2026-11-05; Avsar: 2026-11-21).
 *
 * Every AI Tathastu user gets a profile in each enabled app without a consent screen. The app keeps it PRIVATE
 * (not discoverable, not published, contact details hidden) until the user changes that there. Rules:
 *  - Only users with NO saved choice for that app are provisioned. A user who declined, chose specific sections
 *    or disconnected is never overridden.
 *  - Sharing starts from DEFAULT_SHARED_SCOPES (consent policy v2): basic and professional profile on, Career
 *    Intelligence (readiness, gaps, activity) off until the user turns it on.
 *  - New signups: <APP>_AUTO_PROVISION=1. Existing users (backfill): only with <APP>_AUTO_PROVISION_BACKFILL=1 for
 *    the weekly job, or the operator script (scripts/integration-sync.ts), which has a dry run. Collaborate keeps
 *    its earlier behaviour: its signup flag also enables its weekly backfill.
 *  - The consent row is the normal one (linked), so projection, webhook and revocation machinery apply unchanged.
 */
export const AUTO_PROVISION_CLIENTS = ["collaborate", "avasar"] as const satisfies readonly IntegrationClientId[];
export type AutoProvisionClient = (typeof AUTO_PROVISION_CLIENTS)[number];

const flag = (client: AutoProvisionClient, suffix = "") => process.env[`${client.toUpperCase()}_AUTO_PROVISION${suffix}`] === "1";
export const autoProvisionEnabled = (client: AutoProvisionClient = "collaborate") => flag(client);
export const backfillEnabled = (client: AutoProvisionClient) =>
  client === "collaborate" ? flag(client) || flag(client, "_BACKFILL") : flag(client, "_BACKFILL");

/** Links one user to one app if they have never made a choice there. Returns true if provisioned. */
export async function autoProvision(userId: string, client: AutoProvisionClient, source: ConsentSource = "auto_provision"): Promise<boolean> {
  if (await getConsent(userId, client)) return false; // an explicit choice exists: respect it
  await saveConsent(userId, client, { scopes: DEFAULT_SHARED_SCOPES, link: true, source });
  await enqueueProfileUpdated(userId, "auto_provision", client);
  await markSyncPending(userId, client, "profile.updated");
  return true;
}

/** Signup: every app switched on for new users. One app failing never stops the others (or the signup). */
export async function autoProvisionNewUser(userId: string): Promise<AutoProvisionClient[]> {
  const done: AutoProvisionClient[] = [];
  for (const client of AUTO_PROVISION_CLIENTS) {
    if (!autoProvisionEnabled(client)) continue;
    try {
      if (await autoProvision(userId, client)) done.push(client);
    } catch (error) {
      console.error(`${client} auto-provision failed`, error instanceof Error ? error.message : error);
    }
  }
  return done;
}

/** @deprecated kept for existing callers and tests: Collaborate only, behind its flag. */
export async function autoProvisionCollaborate(userId: string): Promise<boolean> {
  if (!autoProvisionEnabled("collaborate")) return false;
  return autoProvision(userId, "collaborate");
}

/** Active users with no saved choice for this app (the backfill candidates), oldest first. */
export async function pendingProvisionUsers(client: AutoProvisionClient, limit = 200): Promise<string[]> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        isNull(users.deletedAt),
        notExists(
          db
            .select({ one: sql`1` })
            .from(integrationConsents)
            .where(and(eq(integrationConsents.userId, users.id), eq(integrationConsents.clientId, client))),
        ),
      ),
    )
    .orderBy(users.createdAt)
    .limit(limit);
  return rows.map((r) => r.id);
}

/** Weekly job: existing users who have never made a choice, for apps whose backfill is switched on. Bounded per run. */
export async function provisionPendingUsers(limit = 200): Promise<number> {
  let provisioned = 0;
  for (const client of AUTO_PROVISION_CLIENTS) {
    if (!backfillEnabled(client)) continue;
    for (const id of await pendingProvisionUsers(client, limit)) if (await autoProvision(id, client, "backfill")) provisioned++;
  }
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
