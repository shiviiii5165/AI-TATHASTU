import "server-only";

import { hitSlidingLimit } from "@/lib/rate-limit";

const HOUR = 3600;
const DAY = 24 * HOUR;

/**
 * Work a user can trigger that spends money or third-party quota. Well above honest use,
 * since the AI budget is what bounds spend: these stop the queue being flooded. `global`
 * is the ceiling many accounts share. Sliding and atomic in Postgres, so neither parallel
 * requests nor a window boundary get past them, and refused if the count can't be made.
 * Recomputes have their own limit in SQL: see RECOMPUTE in jobs-queue.ts and worker/db.py.
 */
const LIMITS = {
  resume_extract: { user: { limit: 20, windowSeconds: DAY }, global: { limit: 2_000, windowSeconds: DAY } },
  connector_sync: { user: { limit: 30, windowSeconds: DAY }, global: { limit: 5_000, windowSeconds: DAY } },
  github_refresh: { user: { limit: 10, windowSeconds: HOUR }, global: { limit: 2_000, windowSeconds: HOUR } },
  integration_sync: { user: { limit: 10, windowSeconds: HOUR }, global: { limit: 2_000, windowSeconds: HOUR } },
  consent_grant: { user: { limit: 30, windowSeconds: HOUR }, global: { limit: 20_000, windowSeconds: HOUR } },
} as const;

export type PaidWork = keyof typeof LIMITS;

export async function allowPaidWork(userId: string, work: PaidWork) {
  const { user, global } = LIMITS[work];
  // The user's own limit first: one person at their limit shouldn't use up the shared one.
  const own = await hitSlidingLimit(`paid:${work}:${userId}`, user.limit, user.windowSeconds);
  if (!own.ok) {
    console.warn(JSON.stringify({ event: "paid_work_limited", work, scope: "user", userId }));
    return own;
  }
  const shared = await hitSlidingLimit(`paid_global:${work}`, global.limit, global.windowSeconds);
  if (!shared.ok) console.error(JSON.stringify({ event: "paid_work_limited", work, scope: "global" }));
  return shared;
}
