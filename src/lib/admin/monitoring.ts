import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

import { type ComponentCheck, platformChecks } from "./health";
import { listIncidents } from "./incidents";

/**
 * Durable monitoring (migration 0033): route outcomes, health-check history, worker heartbeats and an incident
 * lifecycle. Everything degrades to "not available" when the tables don't exist yet (migration not applied), and
 * recording never breaks the request or job being recorded.
 */

const missingTable = (e: unknown) => /relation .* does not exist|42P01/i.test(String((e as { message?: string })?.message ?? e) + String((e as { code?: string })?.code ?? ""));

// ── Route outcomes (written by lib/api-guard.ts) ─────────────────────────────

/** Ids and numbers become placeholders, so one route is one bucket (and no record id is stored). */
export const normalizeRoute = (route: string) =>
  route
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/\d+(?=\/|$)/g, "/:n")
    .slice(0, 200);

/** One upsert into the route's hourly bucket. Fire-and-forget: a failure here is swallowed. */
export async function recordRouteOutcome(o: { route: string; ok: boolean; ms: number; slow: boolean; error?: string; requestId?: string }): Promise<void> {
  try {
    o = { ...o, route: normalizeRoute(o.route) };
    const hour = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000).toISOString();
    await db.execute(sql`
      INSERT INTO route_stats (route, hour, ok, failed, slow, total_ms, last_error, last_request_id, last_failed_at)
      VALUES (${o.route.slice(0, 200)}, ${hour}::timestamptz, ${o.ok ? 1 : 0}, ${o.ok ? 0 : 1}, ${o.slow ? 1 : 0}, ${Math.round(o.ms)},
              ${o.ok ? null : (o.error ?? "unknown").slice(0, 200)}, ${o.ok ? null : o.requestId ?? null}, ${o.ok ? null : new Date().toISOString()}::timestamptz)
      ON CONFLICT (route, hour) DO UPDATE SET
        ok = route_stats.ok + EXCLUDED.ok, failed = route_stats.failed + EXCLUDED.failed, slow = route_stats.slow + EXCLUDED.slow,
        total_ms = route_stats.total_ms + EXCLUDED.total_ms,
        last_error = coalesce(EXCLUDED.last_error, route_stats.last_error),
        last_request_id = coalesce(EXCLUDED.last_request_id, route_stats.last_request_id),
        last_failed_at = coalesce(EXCLUDED.last_failed_at, route_stats.last_failed_at)`);
  } catch {
    // Monitoring must never fail the request it observes.
  }
}

export interface RouteHealth {
  route: string;
  requests: number;
  failed: number;
  slow: number;
  avgMs: number | null;
  errorRate: number;
  lastError: string | null;
  lastRequestId: string | null;
  lastFailedAt: string | null;
  status: "healthy" | "degraded" | "critical";
}

/** Last 24 h per route. critical ≥ 20% failed (with ≥ 5 requests), degraded = any failure. */
export async function routeHealth(): Promise<{ available: boolean; routes: RouteHealth[] }> {
  try {
    const { rows } = await db.execute(sql`
      SELECT route, sum(ok + failed)::int AS n, sum(failed)::int AS failed, sum(slow)::int AS slow, (sum(total_ms) / nullif(sum(ok + failed), 0))::int AS avg_ms,
             (array_agg(last_error ORDER BY last_failed_at DESC NULLS LAST))[1] AS last_error,
             (array_agg(last_request_id ORDER BY last_failed_at DESC NULLS LAST))[1] AS last_request_id,
             max(last_failed_at) AS last_failed_at
        FROM route_stats WHERE hour > now() - interval '24 hours' GROUP BY route ORDER BY sum(failed) DESC, route`);
    return {
      available: true,
      routes: (rows as Record<string, unknown>[]).map((r) => {
        const n = Number(r.n), failed = Number(r.failed);
        const rate = n ? Math.round((failed / n) * 1000) / 10 : 0;
        return {
          route: String(r.route), requests: n, failed, slow: Number(r.slow), avgMs: r.avg_ms === null ? null : Number(r.avg_ms), errorRate: rate,
          lastError: (r.last_error as string) ?? null, lastRequestId: (r.last_request_id as string) ?? null,
          lastFailedAt: r.last_failed_at ? new Date(r.last_failed_at as string).toISOString() : null,
          status: failed === 0 ? "healthy" : n >= 5 && rate >= 20 ? "critical" : "degraded",
        };
      }),
    };
  } catch (e) {
    if (missingTable(e)) return { available: false, routes: [] };
    throw e;
  }
}

// Worker heartbeats live in ./worker-health (shared with health.ts without a circular import).
export { HEARTBEAT_STALE_MS, WAKE_GRACE_MS, type WorkerBeat, workerBeats, workerStatus } from "./worker-health";

// ── Health-check history ─────────────────────────────────────────────────────

export const MONITOR_VERSION = 1;
export const CHECK_RETENTION_DAYS = 14;
export const ROUTE_RETENTION_DAYS = 30;

/** Runs every platform check, stores the results, syncs incidents and prunes old rows. Called by the cron route. */
export async function runAndRecordHealth(): Promise<{ checks: ComponentCheck[]; recorded: boolean; incidents: number }> {
  const started = Date.now();
  const { components } = await platformChecks();
  const ms = Date.now() - started;
  try {
    for (const c of components) {
      await db.execute(sql`INSERT INTO monitoring_checks (component, status, duration_ms, summary, monitor_version) VALUES (${c.id}, ${c.status}, ${ms}, ${c.summary.slice(0, 300)}, ${MONITOR_VERSION})`);
    }
    await db.execute(sql`DELETE FROM monitoring_checks WHERE checked_at < now() - make_interval(days => ${CHECK_RETENTION_DAYS})`);
    await db.execute(sql`DELETE FROM route_stats WHERE hour < now() - make_interval(days => ${ROUTE_RETENTION_DAYS})`);
    const n = await syncIncidents();
    return { checks: components, recorded: true, incidents: n };
  } catch (e) {
    if (missingTable(e)) return { checks: components, recorded: false, incidents: 0 };
    throw e;
  }
}

export interface CheckHistoryRow { component: string; status: string; summary: string; checkedAt: string }

export async function checkHistory(limitPerComponent = 10): Promise<{ available: boolean; rows: CheckHistoryRow[]; lastRunAt: string | null }> {
  try {
    const { rows } = await db.execute(sql`
      SELECT component, status, summary, checked_at FROM (
        SELECT *, row_number() OVER (PARTITION BY component ORDER BY checked_at DESC) AS rn FROM monitoring_checks
      ) t WHERE rn <= ${limitPerComponent} ORDER BY component, checked_at DESC`);
    const out = (rows as Record<string, unknown>[]).map((r) => ({ component: String(r.component), status: String(r.status), summary: String(r.summary), checkedAt: new Date(r.checked_at as string).toISOString() }));
    return { available: true, rows: out, lastRunAt: out.map((r) => r.checkedAt).sort().at(-1) ?? null };
  } catch (e) {
    if (missingTable(e)) return { available: false, rows: [], lastRunAt: null };
    throw e;
  }
}

/** A scheduled check older than this is stale: its result is shown, but not trusted as current. */
export const HISTORY_STALE_MS = 30 * 60_000;

// ── Incident lifecycle ───────────────────────────────────────────────────────

export const INCIDENT_STATES = ["new", "acknowledged", "investigating", "resolved", "reopened"] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

/**
 * Upserts derived incidents (lib/admin/incidents.ts) into monitoring_incidents by fingerprint. A resolved incident
 * that fails again after it was resolved is reopened. Resolving never changes component health, which is always
 * measured afresh.
 */
export async function syncIncidents(now = new Date()): Promise<number> {
  const derived = await listIncidents(now);
  for (const i of derived) {
    await db.execute(sql`
      INSERT INTO monitoring_incidents (fingerprint, component, severity, first_seen, last_seen, occurrences, latest_error)
      VALUES (${i.id}, ${i.module}, ${i.severity}, ${i.firstSeen}::timestamptz, ${i.lastSeen}::timestamptz, ${i.occurrences}, ${i.latestError})
      ON CONFLICT (fingerprint) DO UPDATE SET
        last_seen = GREATEST(monitoring_incidents.last_seen, EXCLUDED.last_seen),
        occurrences = GREATEST(monitoring_incidents.occurrences, EXCLUDED.occurrences),
        latest_error = EXCLUDED.latest_error,
        severity = EXCLUDED.severity,
        state = CASE WHEN monitoring_incidents.state = 'resolved' AND EXCLUDED.last_seen > monitoring_incidents.resolved_at THEN 'reopened' ELSE monitoring_incidents.state END,
        updated_at = CASE WHEN monitoring_incidents.state = 'resolved' AND EXCLUDED.last_seen > monitoring_incidents.resolved_at THEN now() ELSE monitoring_incidents.updated_at END`);
  }
  await db.execute(sql`DELETE FROM monitoring_incidents WHERE state = 'resolved' AND resolved_at < now() - interval '90 days'`);
  return derived.length;
}

export interface StoredIncident { fingerprint: string; component: string; severity: string; state: IncidentState; firstSeen: string; lastSeen: string; occurrences: number; latestError: string; assignedTo: string | null; resolutionNote: string | null; resolvedAt: string | null; updatedBy: string | null; updatedAt: string }

export async function storedIncidents(): Promise<{ available: boolean; incidents: StoredIncident[] }> {
  try {
    const { rows } = await db.execute(sql`SELECT * FROM monitoring_incidents ORDER BY (state = 'resolved'), last_seen DESC LIMIT 200`);
    const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);
    return {
      available: true,
      incidents: (rows as Record<string, unknown>[]).map((r) => ({
        fingerprint: String(r.fingerprint), component: String(r.component), severity: String(r.severity), state: r.state as IncidentState,
        firstSeen: iso(r.first_seen)!, lastSeen: iso(r.last_seen)!, occurrences: Number(r.occurrences), latestError: String(r.latest_error),
        assignedTo: (r.assigned_to_email as string) ?? null, resolutionNote: (r.resolution_note as string) ?? null, resolvedAt: iso(r.resolved_at),
        updatedBy: (r.updated_by_email as string) ?? null, updatedAt: iso(r.updated_at)!,
      })),
    };
  } catch (e) {
    if (missingTable(e)) return { available: false, incidents: [] };
    throw e;
  }
}

/** Allowed transitions. Anything else is refused. */
const NEXT: Record<IncidentState, IncidentState[]> = {
  new: ["acknowledged", "investigating", "resolved"],
  acknowledged: ["investigating", "resolved"],
  investigating: ["acknowledged", "resolved"],
  resolved: ["reopened"],
  reopened: ["acknowledged", "investigating", "resolved"],
};
export const canMove = (from: IncidentState, to: IncidentState) => NEXT[from]?.includes(to) ?? false;

export async function setIncidentState(fingerprint: string, to: IncidentState, actorEmail: string, note?: string): Promise<{ ok: boolean; error?: string; from?: IncidentState }> {
  const { rows } = await db.execute(sql`SELECT state FROM monitoring_incidents WHERE fingerprint = ${fingerprint}`);
  const from = (rows[0] as { state?: IncidentState } | undefined)?.state;
  if (!from) return { ok: false, error: "Unknown incident." };
  if (!canMove(from, to)) return { ok: false, error: `Can't move an incident from ${from} to ${to}.`, from };
  if (to === "resolved" && !note?.trim()) return { ok: false, error: "Add a resolution note.", from };
  await db.execute(sql`
    UPDATE monitoring_incidents SET state = ${to}, updated_by_email = ${actorEmail}, updated_at = now(),
      assigned_to_email = CASE WHEN ${to} IN ('acknowledged','investigating') THEN ${actorEmail} ELSE assigned_to_email END,
      resolution_note = CASE WHEN ${to} = 'resolved' THEN ${note?.trim().slice(0, 1000) ?? null} ELSE resolution_note END,
      resolved_at = CASE WHEN ${to} = 'resolved' THEN now() ELSE NULL END
    WHERE fingerprint = ${fingerprint}`);
  return { ok: true, from };
}
