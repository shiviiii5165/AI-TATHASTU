import "server-only";

import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { db } from "@/db";

/**
 * Module health and incidents, derived from failure records the app already keeps (jobs, email_deliveries,
 * webhook_outbox, ai_usage_ledger, opportunity_sources). Nothing is stored here: incidents are recomputed on each
 * read, bounded to the last 7 days. Repeated failures with the same cleaned-up error message form one incident.
 * No root cause is ever inferred: the latest error message is shown as evidence, labelled as such.
 */

export type ModuleStatus = "healthy" | "degraded" | "critical" | "unknown";

/** Removes personal data and secrets from an error message before it is shown or fingerprinted. */
export function sanitizeError(msg: string | null | undefined): string {
  if (!msg) return "No error message recorded";
  return msg
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "<email>")
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/\b(sk|pk|rk|ghp|gho|xox[abp])[-_][A-Za-z0-9_-]{8,}\b/g, "<secret>")
    .replace(/\b(bearer|token|key|password|secret)\s*[:=]?\s*\S+/gi, "$1 <redacted>")
    .slice(0, 300);
}

/** Same failure, same fingerprint: ids, numbers and quoted values are normalized away. */
export function fingerprint(module: string, msg: string | null | undefined): string {
  const norm = sanitizeError(msg)
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<id>")
    .replace(/\d+(\.\d+)?/g, "<n>")
    .replace(/(["']).*?\1/g, "<v>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  return createHash("sha256").update(`${module}|${norm}`).digest("hex").slice(0, 12);
}

export interface ModuleHealth {
  id: string;
  name: string;
  /** What students or admins would notice when it fails. */
  impact: string;
  status: ModuleStatus;
  summary: string;
  succeeded24h: number;
  failed24h: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  source: string;
}

type Raw = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

/**
 * healthy: successes and no failures in 24 h. degraded: some failures. critical: failures and no success in 24 h
 * (3 or more). unknown: no activity in 24 h, so nothing proves it works or fails.
 */
export function classify(ok: number, failed: number): ModuleStatus {
  if (ok === 0 && failed === 0) return "unknown";
  if (failed === 0) return "healthy";
  if (ok === 0 && failed >= 3) return "critical";
  return "degraded";
}

const JOB_MODULES: { type: string; name: string; impact: string }[] = [
  { type: "resume_extract", name: "Resume processing", impact: "Uploaded resumes aren't read into profiles." },
  { type: "connector_sync", name: "Connected-account sync", impact: "GitHub, LinkedIn and other data stops updating." },
  { type: "compute_intelligence", name: "Profile intelligence", impact: "Skills, readiness and recommendations go stale." },
  { type: "compute_matches", name: "People matching", impact: "\"People you may know\" stops updating." },
];

export async function moduleHealth(): Promise<ModuleHealth[]> {
  const [jobRows, mail, hooks, ai, sources] = await Promise.all([
    db.execute(sql`
      SELECT type,
             (count(*) FILTER (WHERE status = 'done' AND finished_at > now() - interval '24 hours'))::int AS ok,
             (count(*) FILTER (WHERE status IN ('failed','needs_review') AND coalesce(finished_at, created_at) > now() - interval '24 hours'))::int AS failed,
             max(finished_at) FILTER (WHERE status = 'done') AS last_ok,
             max(coalesce(finished_at, created_at)) FILTER (WHERE status IN ('failed','needs_review')) AS last_fail
        FROM jobs WHERE created_at > now() - interval '30 days' GROUP BY type`),
    db.execute(sql`
      SELECT (count(*) FILTER (WHERE status = 'delivered' AND delivered_at > now() - interval '24 hours'))::int AS ok,
             (count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '24 hours'))::int AS failed,
             max(delivered_at) AS last_ok, max(created_at) FILTER (WHERE status = 'failed') AS last_fail
        FROM email_deliveries WHERE created_at > now() - interval '30 days'`),
    db.execute(sql`
      SELECT (count(*) FILTER (WHERE status = 'delivered' AND delivered_at > now() - interval '24 hours'))::int AS ok,
             (count(*) FILTER (WHERE status = 'failed' AND created_at > now() - interval '24 hours'))::int AS failed,
             max(delivered_at) AS last_ok, max(created_at) FILTER (WHERE status = 'failed') AS last_fail
        FROM webhook_outbox WHERE created_at > now() - interval '30 days'`),
    db.execute(sql`
      SELECT (count(*) FILTER (WHERE (error_kind IS NULL OR error_kind = 'truncated') AND settled_at > now() - interval '24 hours'))::int AS ok,
             (count(*) FILTER (WHERE error_kind IS NOT NULL AND error_kind <> 'truncated' AND settled_at > now() - interval '24 hours'))::int AS failed,
             max(settled_at) FILTER (WHERE error_kind IS NULL) AS last_ok,
             max(settled_at) FILTER (WHERE error_kind IS NOT NULL AND error_kind <> 'truncated') AS last_fail
        FROM ai_usage_ledger WHERE settled_at > now() - interval '30 days'`),
    db.execute(sql`
      SELECT count(*) FILTER (WHERE enabled)::int AS enabled,
             (count(*) FILTER (WHERE enabled AND consecutive_failures = 0 AND last_success_at > now() - interval '24 hours'))::int AS ok,
             (count(*) FILTER (WHERE enabled AND consecutive_failures > 0))::int AS failed,
             max(last_success_at) AS last_ok
        FROM opportunity_sources`).catch(() => ({ rows: [] })),
  ]);

  const out: ModuleHealth[] = [];
  const byType = new Map((jobRows.rows as Raw[]).map((r) => [String(r.type), r]));
  for (const m of JOB_MODULES) {
    const r = byType.get(m.type) ?? {};
    const ok = Number(r.ok ?? 0), failed = Number(r.failed ?? 0);
    out.push({ id: m.type, name: m.name, impact: m.impact, status: classify(ok, failed), summary: summary(ok, failed, "job"), succeeded24h: ok, failed24h: failed, lastSuccessAt: iso(r.last_ok), lastFailureAt: iso(r.last_fail), source: `jobs (type ${m.type})` });
  }
  const push = (id: string, name: string, impact: string, r: Raw | undefined, unit: string, source: string) => {
    const ok = Number(r?.ok ?? 0), failed = Number(r?.failed ?? 0);
    out.push({ id, name, impact, status: classify(ok, failed), summary: summary(ok, failed, unit), succeeded24h: ok, failed24h: failed, lastSuccessAt: iso(r?.last_ok), lastFailureAt: iso(r?.last_fail), source });
  };
  push("email", "Email delivery", "Sign-in links, ticket replies and notices don't arrive.", mail.rows[0] as Raw, "email", "email_deliveries");
  push("webhooks", "Updates to connected apps", "Collaborate and other linked apps see outdated profiles.", hooks.rows[0] as Raw, "update", "webhook_outbox");
  push("ai", "AI calls", "Resume reading and AI features fall back to rule-based results.", ai.rows[0] as Raw, "call", "ai_usage_ledger");
  const src = sources.rows[0] as Raw | undefined;
  if (src && Number(src.enabled ?? 0) > 0) {
    push("research_sources", "Research opportunity sources", "Research listings in AVSAR go stale.", src, "source", "opportunity_sources");
  } else {
    out.push({ id: "research_sources", name: "Research opportunity sources", impact: "Research listings in AVSAR go stale.", status: "unknown", summary: "No source is switched on, so there is nothing to check.", succeeded24h: 0, failed24h: 0, lastSuccessAt: iso(src?.last_ok), lastFailureAt: null, source: "opportunity_sources" });
  }
  return out;
}

function summary(ok: number, failed: number, unit: string) {
  if (ok === 0 && failed === 0) return `No ${unit}s in the last 24 hours, so there's nothing to judge by.`;
  if (failed === 0) return `${ok} ${unit}(s) succeeded in the last 24 hours, none failed.`;
  return `${failed} ${unit}(s) failed and ${ok} succeeded in the last 24 hours.`;
}

export interface Incident {
  id: string;
  module: string;
  severity: "critical" | "warning";
  status: "active" | "quiet";
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  /** Latest error message, cleaned. Evidence, not a diagnosed cause. */
  latestError: string;
  /** Ids of the most recent affected records (jobs, emails…), for investigation. */
  recentRecords: { id: string; at: string }[];
  remediation: string;
}

const REMEDIATION: Record<string, string> = {
  "Resume processing": "Check the worker logs for the job ids below; retry by asking the student to upload again once fixed.",
  "Connected-account sync": "Check the provider's status and the student's connection; the student can reconnect from Integrations.",
  "Profile intelligence": "Check the worker logs for the job ids below; profiles recompute on the next profile change.",
  "People matching": "Check the worker logs for the job ids below.",
  "Email delivery": "Check the email provider and sender settings; failed emails can be retried from the Delivery Outbox.",
  "Updates to connected apps": "Check the receiving app is reachable and its webhook secret matches.",
  "AI calls": "Check the provider's status page and the worker's keys; rate limits clear on their own.",
};

/** Failure records of the last 7 days grouped into incidents. Active = a failure in the last 24 hours. */
export async function listIncidents(now = new Date()): Promise<Incident[]> {
  const [jobs, mail, hooks, ai] = await Promise.all([
    db.execute(sql`SELECT id::text, type AS k, last_error AS err, coalesce(finished_at, created_at) AS at FROM jobs WHERE status IN ('failed','needs_review') AND coalesce(finished_at, created_at) > now() - interval '7 days' ORDER BY at DESC LIMIT 500`),
    db.execute(sql`SELECT id::text, 'email' AS k, last_error AS err, created_at AS at FROM email_deliveries WHERE status = 'failed' AND created_at > now() - interval '7 days' ORDER BY at DESC LIMIT 500`),
    db.execute(sql`SELECT id::text, client_id AS k, last_error AS err, created_at AS at FROM webhook_outbox WHERE status = 'failed' AND created_at > now() - interval '7 days' ORDER BY at DESC LIMIT 500`),
    db.execute(sql`SELECT id::text, provider AS k, error_kind AS err, settled_at AS at FROM ai_usage_ledger WHERE error_kind IS NOT NULL AND error_kind <> 'truncated' AND settled_at > now() - interval '7 days' ORDER BY at DESC LIMIT 500`),
  ]);
  const jobName = new Map(JOB_MODULES.map((m) => [m.type, m.name]));
  const records: { module: string; id: string; err: string | null; at: Date; critical: boolean }[] = [
    ...(jobs.rows as Raw[]).map((r) => ({ module: jobName.get(String(r.k)) ?? String(r.k), id: String(r.id), err: r.err as string | null, at: new Date(r.at as string), critical: true })),
    ...(mail.rows as Raw[]).map((r) => ({ module: "Email delivery", id: String(r.id), err: r.err as string | null, at: new Date(r.at as string), critical: true })),
    ...(hooks.rows as Raw[]).map((r) => ({ module: "Updates to connected apps", id: String(r.id), err: `${r.k}: ${r.err ?? ""}`, at: new Date(r.at as string), critical: false })),
    // A rate limit is expected back-pressure, not an outage.
    ...(ai.rows as Raw[]).map((r) => ({ module: "AI calls", id: String(r.id), err: `${r.k}: ${r.err}`, at: new Date(r.at as string), critical: r.err !== "rate_limited" })),
  ];

  const groups = new Map<string, Incident>();
  for (const rec of records) {
    const id = fingerprint(rec.module, rec.err);
    const g = groups.get(id);
    const at = rec.at.toISOString();
    if (!g) {
      groups.set(id, {
        id, module: rec.module, severity: rec.critical ? "critical" : "warning", status: "quiet", occurrences: 1, firstSeen: at, lastSeen: at,
        latestError: sanitizeError(rec.err), recentRecords: [{ id: rec.id, at }], remediation: REMEDIATION[rec.module] ?? "Check the worker and application logs for the record ids below.",
      });
    } else {
      g.occurrences++;
      if (at < g.firstSeen) g.firstSeen = at;
      if (at > g.lastSeen) { g.lastSeen = at; g.latestError = sanitizeError(rec.err); }
      if (g.recentRecords.length < 10) g.recentRecords.push({ id: rec.id, at });
    }
  }
  const dayAgo = now.getTime() - 86_400_000;
  for (const g of groups.values()) g.status = new Date(g.lastSeen).getTime() > dayAgo ? "active" : "quiet";
  const rank = (i: Incident) => (i.status === "active" ? 0 : 2) + (i.severity === "critical" ? 0 : 1);
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || b.lastSeen.localeCompare(a.lastSeen));
}
