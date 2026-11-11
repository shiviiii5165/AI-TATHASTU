import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { queueConnectorSync } from "@/lib/connectors/connections";
import { wakeWorker } from "@/lib/worker-ping";

/**
 * The contribution calendar is fetched only during a GitHub sync (worker/connectors/github.py), and syncs don't
 * run on a schedule. Accounts connected before the calendar existed therefore have repositories but never a
 * calendar. When such a user opens the dashboard, this queues one GitHub sync for them.
 *
 * Safe by construction:
 *  - only when migration 0027 has run and the user has no calendar row at all (a failed attempt writes a row,
 *    so a user whose sync failed is never re-queued here; they use "Sync GitHub now" instead);
 *  - one job per connection, ever: the fixed idempotency key makes a repeat a no-op (ON CONFLICT DO NOTHING),
 *    and queueConnectorSync adds nothing while a sync is already queued;
 *  - never throws into the page.
 */
export const INITIAL_CALENDAR_SYNC_KEY = "contributions-initial";

export async function ensureContributionCalendar(userId: string, connectionId: string | null): Promise<"queued" | "skipped"> {
  if (!connectionId) return "skipped";
  try {
    const { rows: table } = await db.execute(sql`SELECT to_regclass('public.github_contributions') IS NOT NULL AS present`);
    if (!table[0]?.present) return "skipped";
    const { rows } = await db.execute(sql`SELECT 1 AS one FROM github_contributions WHERE user_id = ${userId} LIMIT 1`);
    if (rows.length > 0) return "skipped";
    await queueConnectorSync(userId, connectionId, "github", INITIAL_CALENDAR_SYNC_KEY);
    wakeWorker("connector_sync:github:calendar");
    return "queued";
  } catch (err) {
    console.error("[ensureContributionCalendar] skipped:", err instanceof Error ? err.message : "unknown error");
    return "skipped";
  }
}
