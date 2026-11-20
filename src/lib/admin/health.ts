import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";
import { ALERT_AFTER_ATTEMPTS } from "@/lib/account-deletion";

import { workerBeats, workerStatus } from "./worker-health";

/**
 * Real health checks, shared by /api/internal/queue-health (uptime monitor) and the admin Operational Health page.
 * A component gets a status only from a measurement taken now. Anything we can't measure is "not_monitored",
 * never "healthy".
 */

// Same thresholds the uptime monitor has always used.
export const MAX_QUEUE_AGE_SECONDS = 15 * 60;
export const MAX_EXPIRED_RUNNING = 0;
export const MAX_FAILED_LAST_HOUR = 25;

export interface QueueHealth {
  queued: number;
  oldest_queued_seconds: number;
  running: number;
  expired_running: number;
  failed_last_hour: number;
  deletions_failing: number;
  deletions_overdue: number;
  ai_reservations_stuck: number;
  ai_budget_warning: boolean;
}

export async function queueHealth(): Promise<{ health: QueueHealth; alerts: string[] }> {
  const { rows } = await db.execute(sql`
    SELECT
      (SELECT count(*)::int FROM jobs WHERE status = 'queued' AND run_at <= now()) AS queued,
      (SELECT coalesce(extract(epoch FROM now() - min(run_at)), 0)::int FROM jobs WHERE status = 'queued' AND run_at <= now()) AS oldest_queued_seconds,
      (SELECT count(*)::int FROM jobs WHERE status = 'running' AND locked_until >= now()) AS running,
      (SELECT count(*)::int FROM jobs WHERE status = 'running' AND locked_until < now() - interval '5 minutes') AS expired_running,
      (SELECT count(*)::int FROM jobs WHERE status = 'failed' AND finished_at > now() - interval '1 hour') AS failed_last_hour,
      (SELECT count(*)::int FROM account_deletions WHERE status = 'partially_failed' AND attempts >= ${ALERT_AFTER_ATTEMPTS}) AS deletions_failing,
      (SELECT count(*)::int FROM account_deletions WHERE status <> 'completed' AND created_at < now() - interval '3 days') AS deletions_overdue,
      (SELECT count(*)::int FROM ai_usage_ledger WHERE status = 'reserved' AND expires_at < now() - interval '1 hour') AS ai_reservations_stuck,
      (SELECT coalesce(bool_or(c.metered_usd + c.estimated_usd + c.reserved_usd >= b.budget_usd * b.warning_threshold_percent / 100.0), false)
         FROM ai_spend_counters c, (SELECT budget_usd, warning_threshold_percent FROM ai_cost_budgets ORDER BY id LIMIT 1) b
        WHERE c.scope = 'global' AND c.period = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM')) AS ai_budget_warning`);
  const health = rows[0] as unknown as QueueHealth;
  const alerts = [
    health.oldest_queued_seconds > MAX_QUEUE_AGE_SECONDS && "queue_age",
    health.expired_running > MAX_EXPIRED_RUNNING && "stuck_jobs",
    health.failed_last_hour > MAX_FAILED_LAST_HOUR && "failures",
    (health.deletions_failing > 0 || health.deletions_overdue > 0) && "account_deletions",
    (health.ai_budget_warning || health.ai_reservations_stuck > 0) && "ai_budget",
  ].filter((a): a is string => Boolean(a));
  return { health, alerts };
}

export type HealthStatus = "healthy" | "warning" | "critical" | "not_monitored";

export interface ComponentCheck {
  id: string;
  name: string;
  status: HealthStatus;
  summary: string;
  facts: { label: string; value: string }[];
  /** Where an admin can act on it. */
  href?: string;
}

const mins = (s: number) => (s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 360) / 10} h`);

/** Every check, measured now. A failed query makes that component critical; it never hides as healthy. */
export async function platformChecks(now = new Date()): Promise<{ checkedAt: string; components: ComponentCheck[]; overall: HealthStatus }> {
  const components: ComponentCheck[] = [];

  // Database: a real round trip, timed.
  const t0 = performance.now();
  let dbOk = true;
  try {
    await db.execute(sql`SELECT 1`);
  } catch {
    dbOk = false;
  }
  const dbMs = Math.round(performance.now() - t0);
  components.push({
    id: "database",
    name: "Database",
    status: !dbOk ? "critical" : dbMs > 2000 ? "warning" : "healthy",
    summary: !dbOk ? "Could not run a test query." : `Answered a test query in ${dbMs} ms.`,
    facts: [{ label: "Response time", value: dbOk ? `${dbMs} ms` : "—" }],
  });

  // Background jobs (the worker's queue): same thresholds as the uptime monitor.
  try {
    const { health: h } = await queueHealth();
    const critical = h.expired_running > MAX_EXPIRED_RUNNING || h.oldest_queued_seconds > MAX_QUEUE_AGE_SECONDS;
    const warning = h.failed_last_hour > 0;
    components.push({
      id: "jobs",
      name: "Background jobs",
      status: h.failed_last_hour > MAX_FAILED_LAST_HOUR || critical ? "critical" : warning ? "warning" : "healthy",
      summary: critical
        ? h.expired_running > 0
          ? `${h.expired_running} job(s) stopped mid-run and were not picked up again.`
          : `The oldest waiting job has waited ${mins(h.oldest_queued_seconds)}: the worker may be down or overloaded.`
        : warning
          ? `${h.failed_last_hour} job(s) failed in the last hour.`
          : "Jobs are being picked up on time.",
      facts: [
        { label: "Waiting", value: String(h.queued) },
        { label: "Oldest waiting", value: h.queued ? mins(h.oldest_queued_seconds) : "—" },
        { label: "Running", value: String(h.running) },
        { label: "Stuck", value: String(h.expired_running) },
        { label: "Failed (1 h)", value: String(h.failed_last_hour) },
      ],
    });
    components.push({
      id: "deletions",
      name: "Account deletions",
      status: h.deletions_failing > 0 || h.deletions_overdue > 0 ? "critical" : "healthy",
      summary: h.deletions_failing || h.deletions_overdue ? "Some account deletions are failing or overdue." : "No deletion is failing or overdue.",
      facts: [
        { label: "Failing", value: String(h.deletions_failing) },
        { label: "Older than 3 days", value: String(h.deletions_overdue) },
      ],
    });
    components.push({
      id: "ai_budget",
      name: "AI spending limits",
      status: h.ai_reservations_stuck > 0 ? "warning" : h.ai_budget_warning ? "warning" : "healthy",
      summary: h.ai_budget_warning ? "This month's AI spend has passed the warning threshold." : h.ai_reservations_stuck ? "Some AI cost reservations were never settled." : "Spend is under the warning threshold.",
      facts: [
        { label: "Past warning threshold", value: h.ai_budget_warning ? "Yes" : "No" },
        { label: "Unsettled reservations", value: String(h.ai_reservations_stuck) },
      ],
      href: "/admin/ai-ops/costs",
    });
  } catch {
    components.push({ id: "jobs", name: "Background jobs", status: "critical", summary: "The job queue could not be read.", facts: [] });
  }

  // Email outbox and webhooks: backlog and failures.
  try {
    const { rows } = await db.execute(sql`
      SELECT
        (SELECT count(*)::int FROM email_deliveries WHERE status = 'queued') AS email_queued,
        (SELECT coalesce(extract(epoch FROM now() - min(created_at)), 0)::int FROM email_deliveries WHERE status = 'queued') AS email_oldest,
        (SELECT count(*)::int FROM email_deliveries WHERE status = 'failed') AS email_failed,
        (SELECT max(delivered_at) FROM email_deliveries WHERE status = 'delivered') AS email_last_ok,
        (SELECT count(*)::int FROM webhook_outbox WHERE status = 'pending') AS hooks_pending,
        (SELECT count(*)::int FROM webhook_outbox WHERE status = 'failed') AS hooks_failed`);
    const e = rows[0] as { email_queued: number; email_oldest: number; email_failed: number; email_last_ok: string | null; hooks_pending: number; hooks_failed: number };
    components.push({
      id: "email",
      name: "Email delivery",
      status: e.email_failed > 0 || (e.email_queued > 0 && e.email_oldest > 3600) ? "warning" : "healthy",
      summary: e.email_failed > 0 ? `${e.email_failed} email(s) failed to send.` : e.email_queued > 0 && e.email_oldest > 3600 ? "Emails have been waiting over an hour." : "No failed or long-waiting emails.",
      facts: [
        { label: "Waiting", value: String(e.email_queued) },
        { label: "Failed", value: String(e.email_failed) },
        { label: "Last delivered", value: e.email_last_ok ? new Date(e.email_last_ok).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never" },
      ],
      href: "/admin/emails/deliveries",
    });
    components.push({
      id: "webhooks",
      name: "Updates to connected apps",
      status: e.hooks_failed > 0 ? "warning" : "healthy",
      summary: e.hooks_failed > 0 ? `${e.hooks_failed} update(s) to connected apps failed.` : "No failed updates to connected apps.",
      facts: [
        { label: "Waiting", value: String(e.hooks_pending) },
        { label: "Failed", value: String(e.hooks_failed) },
      ],
    });
  } catch {
    components.push({ id: "email", name: "Email delivery", status: "critical", summary: "The email outbox could not be read.", facts: [] });
  }

  // Nothing measures these directly today.
  // Worker heartbeat (migration 0033 + worker/worker.py). No heartbeat table or no beat yet → not monitored.
  try {
    const { available, beats } = await workerBeats();
    const w = available ? workerStatus(beats, now.getTime()) : { status: "unknown" as const, summary: "Heartbeat storage isn't set up (migration 0033 not applied)." };
    const latest = beats[0];
    components.push({
      id: "worker",
      name: "Background worker service",
      status: w.status === "unknown" ? "not_monitored" : w.status,
      summary: w.summary,
      facts: latest ? [{ label: "Last heartbeat", value: new Date(latest.lastBeat).toISOString().slice(11, 19) + " UTC" }, { label: "State", value: latest.state }, { label: "Version", value: latest.version ?? "—" }] : [],
    });
  } catch {
    components.push({ id: "worker", name: "Background worker service", status: "critical", summary: "Worker heartbeats couldn't be read.", facts: [] });
  }
  components.push(
    { id: "storage", name: "File storage", status: "not_monitored", summary: "Uploads aren't test-checked from here.", facts: [] },
  );

  const rank: Record<HealthStatus, number> = { critical: 3, warning: 2, healthy: 1, not_monitored: 0 };
  const overall = components.reduce<HealthStatus>((w, c) => (rank[c.status] > rank[w] ? c.status : w), "not_monitored");
  return { checkedAt: now.toISOString(), components, overall };
}
