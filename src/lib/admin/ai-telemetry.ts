import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * AI call telemetry from ai_usage_ledger, as the worker writes it (worker/ai_budget.py):
 *   metered   provider reported tokens; cost = tokens × the worker's configured rates
 *   estimated provider may have done work but reported no usage (e.g. a timeout); cost = the full reservation
 *   released  provider rejected before doing work (rate limit, auth, not found); cost 0
 *   reserved  still in flight (not counted as a call until settled)
 * error_kind: null = success; "rate_limited"; "refused" (provider rejected the request: an access/availability
 * failure, not a content refusal); "truncated" (answer cut off at the length limit, work done);
 * otherwise the exception class name (timeouts contain "Timeout").
 * All windows are UTC. Costs are our calculation, never an invoice.
 */

export const WINDOWS = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days", month: "This month" } as const;
export type Window = keyof typeof WINDOWS;
export const isWindow = (w: string | undefined): w is Window => !!w && w in WINDOWS;

export function windowStart(w: Window, now = new Date()): Date {
  const d0 = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (w === "today") return new Date(d0);
  if (w === "7d") return new Date(d0 - 6 * 86_400_000);
  if (w === "30d") return new Date(d0 - 29 * 86_400_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface CallStats {
  calls: number;
  succeeded: number;
  rateLimited: number;
  rejected: number;
  timeouts: number;
  otherErrors: number;
  truncated: number;
  /** succeeded ÷ calls, 0-100; null when no calls. */
  successRate: number | null;
  /** Over successful calls only, in ms. */
  latency: { avg: number | null; median: number | null; p95: number | null };
  tokensIn: number;
  tokensOut: number;
  meteredUsd: number;
  estimatedUsd: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

const STATS_SQL = sql`
  count(*)::int AS calls,
  (count(*) FILTER (WHERE error_kind IS NULL))::int AS succeeded,
  (count(*) FILTER (WHERE error_kind = 'rate_limited'))::int AS rate_limited,
  (count(*) FILTER (WHERE error_kind = 'refused'))::int AS rejected,
  (count(*) FILTER (WHERE error_kind ILIKE '%timeout%'))::int AS timeouts,
  (count(*) FILTER (WHERE error_kind IS NOT NULL AND error_kind NOT IN ('rate_limited','refused','truncated') AND error_kind NOT ILIKE '%timeout%'))::int AS other_errors,
  (count(*) FILTER (WHERE error_kind = 'truncated'))::int AS truncated,
  avg(latency_ms) FILTER (WHERE error_kind IS NULL) AS lat_avg,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE error_kind IS NULL AND latency_ms IS NOT NULL) AS lat_p50,
  percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) FILTER (WHERE error_kind IS NULL AND latency_ms IS NOT NULL) AS lat_p95,
  coalesce(sum(tokens_in), 0)::bigint AS tokens_in,
  coalesce(sum(tokens_out), 0)::bigint AS tokens_out,
  coalesce(sum(cost_usd) FILTER (WHERE status = 'metered'), 0) AS metered,
  coalesce(sum(cost_usd) FILTER (WHERE status = 'estimated'), 0) AS estimated,
  max(settled_at) FILTER (WHERE error_kind IS NULL) AS last_ok,
  max(settled_at) FILTER (WHERE error_kind IS NOT NULL AND error_kind <> 'truncated') AS last_fail`;

type Raw = Record<string, unknown>;
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

function toStats(r: Raw): CallStats {
  const calls = Number(r.calls ?? 0);
  const succeeded = Number(r.succeeded ?? 0);
  return {
    calls,
    succeeded,
    rateLimited: Number(r.rate_limited ?? 0),
    rejected: Number(r.rejected ?? 0),
    timeouts: Number(r.timeouts ?? 0),
    otherErrors: Number(r.other_errors ?? 0),
    truncated: Number(r.truncated ?? 0),
    successRate: calls ? Math.round((succeeded / calls) * 1000) / 10 : null,
    latency: { avg: n(r.lat_avg) === null ? null : Math.round(n(r.lat_avg)!), median: n(r.lat_p50) === null ? null : Math.round(n(r.lat_p50)!), p95: n(r.lat_p95) === null ? null : Math.round(n(r.lat_p95)!) },
    tokensIn: Number(r.tokens_in ?? 0),
    tokensOut: Number(r.tokens_out ?? 0),
    meteredUsd: Number(r.metered ?? 0),
    estimatedUsd: Number(r.estimated ?? 0),
    lastSuccessAt: iso(r.last_ok),
    lastFailureAt: iso(r.last_fail),
  };
}

/** Per-provider and per-model call statistics for a window (settled calls only). */
export async function providerTelemetry(w: Window, now = new Date()) {
  const from = windowStart(w, now).toISOString();
  const [byProvider, byModel, inFlight] = await Promise.all([
    db.execute(sql`SELECT provider, ${STATS_SQL} FROM ai_usage_ledger WHERE settled_at IS NOT NULL AND created_at >= ${from}::timestamptz GROUP BY provider ORDER BY count(*) DESC, provider`),
    db.execute(sql`SELECT provider, model, ${STATS_SQL} FROM ai_usage_ledger WHERE settled_at IS NOT NULL AND created_at >= ${from}::timestamptz GROUP BY provider, model ORDER BY provider, count(*) DESC, model`),
    db.execute(sql`SELECT count(*)::int AS n FROM ai_usage_ledger WHERE status = 'reserved' AND expires_at > now()`),
  ]);
  return {
    window: w,
    from,
    providers: (byProvider.rows as Raw[]).map((r) => ({ provider: String(r.provider), ...toStats(r) })),
    models: (byModel.rows as Raw[]).map((r) => ({ provider: String(r.provider), model: String(r.model), ...toStats(r) })),
    inFlight: Number((inFlight.rows[0] as Raw).n ?? 0),
  };
}

/** Daily measured and estimated cost for the window (UTC days, zero-filled). */
export async function dailySpend(w: Window, now = new Date()) {
  const start = windowStart(w, now);
  const { rows } = await db.execute(sql`
    SELECT day, coalesce(sum(cost_usd) FILTER (WHERE status = 'metered'), 0) AS metered, coalesce(sum(cost_usd) FILTER (WHERE status = 'estimated'), 0) AS estimated
      FROM ai_usage_ledger WHERE settled_at IS NOT NULL AND created_at >= ${start.toISOString()}::timestamptz GROUP BY day`);
  const by = new Map((rows as Raw[]).map((r) => [String(r.day), r]));
  const out: { day: string; meteredUsd: number; estimatedUsd: number }[] = [];
  for (let t = start.getTime(); t <= now.getTime(); t += 86_400_000) {
    const day = new Date(t).toISOString().slice(0, 10);
    const r = by.get(day);
    out.push({ day, meteredUsd: Number(r?.metered ?? 0), estimatedUsd: Number(r?.estimated ?? 0) });
  }
  return out;
}

/** Cost by what the call was for (resume extraction, matching…), for the window. */
export async function spendByPurpose(w: Window, now = new Date()) {
  const { rows } = await db.execute(sql`
    SELECT purpose, count(*)::int AS calls, coalesce(sum(cost_usd), 0) AS cost
      FROM ai_usage_ledger WHERE settled_at IS NOT NULL AND created_at >= ${windowStart(w, now).toISOString()}::timestamptz
     GROUP BY purpose ORDER BY coalesce(sum(cost_usd), 0) DESC, purpose LIMIT 20`);
  return (rows as Raw[]).map((r) => ({ purpose: String(r.purpose), calls: Number(r.calls), costUsd: Number(r.cost) }));
}

/**
 * Month-end projection from this month's settled spend so far, at the same daily rate. A projection, not a
 * prediction: it assumes the rest of the month looks like the days so far. Null before a full day has passed.
 */
export function projectMonthEnd(spentSoFar: number, now = new Date()): number | null {
  const day = now.getUTCDate() - 1 + (now.getUTCHours() * 60 + now.getUTCMinutes()) / 1440;
  if (day < 1) return null;
  const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
  return Math.round((spentSoFar / day) * daysInMonth * 100) / 100;
}
