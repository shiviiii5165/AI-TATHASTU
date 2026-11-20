import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Admin Overview metrics. Every number is a database aggregate over the stated population; nothing is sampled
 * from a displayed page of rows and nothing is written. Deleted (tombstoned) accounts are excluded throughout.
 */

const rows = async <T>(q: ReturnType<typeof sql>) => (await db.execute(q)).rows as T[];
const one = async <T>(q: ReturnType<typeof sql>) => (await rows<T>(q))[0]!;

/** The last `months` calendar months (UTC) as YYYY-MM, oldest first; every month present, zero-filled. */
export function monthKeys(months: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

const fill = (keys: string[], data: { month: string; n: number }[]) => {
  const by = new Map(data.map((d) => [d.month, Number(d.n)]));
  return keys.map((month) => ({ month, value: by.get(month) ?? 0 }));
};

export async function platformSummary() {
  const s = await one<{ total: number; students: number; faculty: number; alumni: number; new30: number; onboarded: number; resumes: number; connected: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL) AS total,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND role = 'student') AS students,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND role = 'faculty') AS faculty,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND role = 'alumni') AS alumni,
      (SELECT count(*)::int FROM users WHERE deleted_at IS NULL AND created_at > now() - interval '30 days') AS new30,
      (SELECT count(*)::int FROM users u JOIN onboarding_state o ON o.user_id = u.id WHERE u.deleted_at IS NULL AND o.completed_at IS NOT NULL) AS onboarded,
      (SELECT count(DISTINCT f.user_id)::int FROM files f JOIN users u ON u.id = f.user_id WHERE u.deleted_at IS NULL AND f.kind = 'resume') AS resumes,
      (SELECT count(DISTINCT c.user_id)::int FROM connections c JOIN users u ON u.id = c.user_id WHERE u.deleted_at IS NULL AND c.status = 'connected') AS connected`);
  const bySource = await rows<{ source: string; n: number }>(sql`
    SELECT c.source_id AS source, count(DISTINCT c.user_id)::int AS n
      FROM connections c JOIN users u ON u.id = c.user_id
     WHERE u.deleted_at IS NULL AND c.status = 'connected'
     GROUP BY c.source_id ORDER BY n DESC, source`);
  return { ...s, notOnboarded: s.total - s.onboarded, connectionsBySource: bySource.map((r) => ({ source: r.source, users: Number(r.n) })) };
}

/** Monthly counts from real timestamps. Months with no records show 0 because the count really is 0. */
export async function growthTrends(months = 12, now = new Date()) {
  const keys = monthKeys(months, now);
  const from = `${keys[0]}-01`;
  const [registrations, onboardings, resumes] = await Promise.all([
    rows<{ month: string; n: number }>(sql`SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, count(*)::int AS n FROM users WHERE deleted_at IS NULL AND created_at >= ${from}::date GROUP BY 1`),
    rows<{ month: string; n: number }>(sql`SELECT to_char(o.completed_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, count(*)::int AS n FROM onboarding_state o JOIN users u ON u.id = o.user_id WHERE u.deleted_at IS NULL AND o.completed_at >= ${from}::date GROUP BY 1`),
    rows<{ month: string; n: number }>(sql`SELECT to_char(f.created_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month, count(*)::int AS n FROM files f JOIN users u ON u.id = f.user_id WHERE u.deleted_at IS NULL AND f.kind = 'resume' AND f.created_at >= ${from}::date GROUP BY 1`),
  ]);
  return { registrations: fill(keys, registrations), onboardings: fill(keys, onboardings), resumeUploads: fill(keys, resumes) };
}

/** Items that need an administrator, each counted across its whole table. */
export async function actionRequired() {
  return one<{
    openTickets: number; urgentTickets: number; overdueTickets: number;
    failedJobs24h: number; failedJobsTotal: number; staleQueuedJobs: number; jobsNeedingReview: number;
    emailsQueued: number; emailsFailed: number;
    pendingInstitutions: number; deletionsInProgress: number; deletionsFailing: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM support_tickets WHERE status NOT IN ('resolved','closed')) AS "openTickets",
      (SELECT count(*)::int FROM support_tickets WHERE status NOT IN ('resolved','closed') AND priority IN ('urgent','high')) AS "urgentTickets",
      (SELECT count(*)::int FROM support_tickets WHERE status NOT IN ('resolved','closed') AND resolution_due_at < now()) AS "overdueTickets",
      (SELECT count(*)::int FROM jobs WHERE status = 'failed' AND finished_at > now() - interval '24 hours') AS "failedJobs24h",
      (SELECT count(*)::int FROM jobs WHERE status = 'failed') AS "failedJobsTotal",
      (SELECT count(*)::int FROM jobs WHERE status = 'queued' AND run_at < now() - interval '15 minutes') AS "staleQueuedJobs",
      (SELECT count(*)::int FROM jobs WHERE status = 'needs_review') AS "jobsNeedingReview",
      (SELECT count(*)::int FROM email_deliveries WHERE status = 'queued') AS "emailsQueued",
      (SELECT count(*)::int FROM email_deliveries WHERE status = 'failed') AS "emailsFailed",
      (SELECT count(*)::int FROM institutions WHERE verification_status = 'pending') AS "pendingInstitutions",
      (SELECT count(*)::int FROM account_deletions WHERE status <> 'completed') AS "deletionsInProgress",
      (SELECT count(*)::int FROM account_deletions WHERE status = 'partially_failed') AS "deletionsFailing"`);
}

/** AI calls and cost per month from the settled spend ledger. Metered and estimated cost stay separate. */
export async function aiUsageTrend(months = 6, now = new Date()) {
  const keys = monthKeys(months, now);
  const data = await rows<{ month: string; calls: number; failed: number; metered: string | null; estimated: string | null }>(sql`
    SELECT month,
           count(*)::int AS calls,
           (count(*) FILTER (WHERE error_kind IS NOT NULL))::int AS failed,
           sum(cost_usd) FILTER (WHERE status = 'metered') AS metered,
           sum(cost_usd) FILTER (WHERE status = 'estimated') AS estimated
      FROM ai_usage_ledger
     WHERE settled_at IS NOT NULL AND month >= ${keys[0]}
     GROUP BY month`);
  const by = new Map(data.map((d) => [d.month, d]));
  return keys.map((month) => {
    const d = by.get(month);
    return { month, calls: Number(d?.calls ?? 0), failed: Number(d?.failed ?? 0), meteredUsd: Number(d?.metered ?? 0), estimatedUsd: Number(d?.estimated ?? 0) };
  });
}
