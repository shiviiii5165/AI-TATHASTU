import { Activity, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { desc } from "drizzle-orm";

import { db } from "@/db";
import { jobs } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { type HealthStatus, platformChecks } from "@/lib/admin/health";
import { type Incident, listIncidents, type ModuleStatus, moduleHealth, sanitizeError } from "@/lib/admin/incidents";
import { canMove, checkHistory, HISTORY_STALE_MS, INCIDENT_STATES, routeHealth, storedIncidents } from "@/lib/admin/monitoring";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { fullTimestamp } from "@/lib/admin/summaries";

import { updateIncidentAction } from "./actions";

export const metadata = {
  title: "Operational Health · Admin Control Center",
  robots: { index: false },
};

type Tone = "healthy" | "degraded" | "critical" | "unknown" | "not_monitored";
const TONE: Record<Tone, { label: string; dot: string; badge: string }> = {
  healthy: { label: "Healthy", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  degraded: { label: "Degraded", dot: "bg-amber-500", badge: "bg-amber-500/10 text-amber-800 dark:text-amber-400" },
  critical: { label: "Critical", dot: "bg-rose-500", badge: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  unknown: { label: "Unknown", dot: "bg-muted-foreground/50", badge: "bg-muted text-muted-foreground" },
  not_monitored: { label: "Not monitored", dot: "bg-muted-foreground/30", badge: "bg-muted text-muted-foreground" },
};
const fromCheck = (s: HealthStatus): Tone => (s === "warning" ? "degraded" : s);
const Badge = ({ t }: { t: Tone }) => (
  <span className={`inline-flex items-center gap-1.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${TONE[t].badge}`}>
    <span aria-hidden className={`size-1.5 rounded-full ${TONE[t].dot}`} /> {TONE[t].label}
  </span>
);
const when = (s: string | null) => (s ? fullTimestamp(s) : "—");

type SP = { severity?: string; module?: string; status?: string; incident?: string; lifecycle?: string };

export default async function AdminSystemPage({ searchParams }: { searchParams?: Promise<SP> } = {}) {
  await connection();
  await requireAdmin();
  await requireAdminPermission("system.manage");
  const sp = (await searchParams) ?? {};

  // Measured when the page loads; nothing is cached, so nothing here can be stale.
  const [checks, modules, incidents, recentJobs, routes, stored, history] = await Promise.all([
    platformChecks(),
    moduleHealth(),
    listIncidents(),
    db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(15),
    routeHealth(),
    storedIncidents(),
    checkHistory(5),
  ]);
  const lifecycle = new Map(stored.incidents.map((i) => [i.fingerprint, i]));
  const historyStale = history.lastRunAt ? new Date().getTime() - new Date(history.lastRunAt).getTime() > HISTORY_STALE_MS : true;
  const [lcKind, ...lcMsg] = (sp.lifecycle ?? "").split(":");

  // One list of everything we report on: platform checks + application modules.
  const all: Tone[] = [...checks.components.map((c) => fromCheck(c.status)), ...modules.map((m) => m.status as ModuleStatus)];
  const count = (t: Tone) => all.filter((x) => x === t).length;
  const measured = all.filter((t) => t !== "not_monitored" && t !== "unknown").length;
  const active = incidents.filter((i) => i.status === "active");
  // Conservative: any critical part makes the platform critical; any degraded part or active incident makes it
  // degraded; unknown and unmonitored parts never count as healthy (no measurements at all → unknown).
  const overall: Tone = count("critical") ? "critical" : count("degraded") || active.length ? "degraded" : measured === 0 ? "unknown" : "healthy";

  const shown = incidents.filter(
    (i) => (!sp.severity || i.severity === sp.severity) && (!sp.module || i.module === sp.module) && (!sp.status || i.status === sp.status),
  );
  const selected: Incident | undefined = sp.incident ? incidents.find((i) => i.id === sp.incident) : undefined;
  const modulesInIncidents = [...new Set(incidents.map((i) => i.module))];
  const qs = (over: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ severity: sp.severity, module: sp.module, status: sp.status, ...over })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/system?${s}#incidents` : "/admin/system#incidents";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="size-6 text-primary" />
            <span>Operational Health</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Checked {fullTimestamp(checks.checkedAt)}. Reload to check again.</p>
        </div>
      </div>

      {/* Summary */}
      <section aria-label="Summary" className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="health-summary">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1 rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-muted-foreground">Overall</div>
          <div className="mt-1.5" data-testid="overall-status"><Badge t={overall} /></div>
        </div>
        {(["healthy", "degraded", "critical", "unknown", "not_monitored"] as Tone[]).map((t) => (
          <div key={t} className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
            <div className="text-[11px] font-semibold text-muted-foreground">{TONE[t].label}</div>
            <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{count(t)}</div>
          </div>
        ))}
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-muted-foreground">Active incidents</div>
          <div className="mt-1 text-xl font-bold tabular-nums text-foreground">{active.length}</div>
        </div>
      </section>
      <p className="text-[11px] text-muted-foreground" data-testid="coverage">
        Monitoring coverage: {measured} of {all.length} parts ({all.length ? Math.round((measured / all.length) * 100) : 0}%) had a measurement that proves their state.
        &quot;Unknown&quot; means no recent activity to judge by; &quot;Not monitored&quot; means nothing measures it. Neither counts as healthy.
      </p>

      {/* Platform */}
      <section aria-labelledby="platform" className="space-y-3">
        <h2 id="platform" className="text-sm font-bold text-foreground">Platform</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="component-status">
          {checks.components.map((c) => (
            <div key={c.id} className="rounded-2xl border border-border bg-card p-4 shadow-2xs space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-bold text-foreground">{c.name}</h3>
                <Badge t={fromCheck(c.status)} />
              </div>
              <p className="text-[11px] text-muted-foreground">{c.summary}</p>
              {c.facts.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-3 text-[11px]">
                  {c.facts.map((f) => (
                    <div key={f.label} className="flex justify-between gap-2 border-b border-border/50 py-0.5"><dt className="text-muted-foreground">{f.label}</dt><dd className="font-mono font-semibold text-foreground">{f.value}</dd></div>
                  ))}
                </dl>
              )}
              {c.href && <Link href={c.href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">Open <ArrowUpRight aria-hidden className="size-3" /></Link>}
            </div>
          ))}
        </div>
      </section>

      {/* Application modules */}
      <section aria-labelledby="modules" className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden">
        <h2 id="modules" className="p-4 border-b border-border text-sm font-bold text-foreground">Application features (last 24 hours)</h2>
        <div className="relative overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="module-health">
            <caption className="sr-only">Health of application features</caption>
            <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
              <tr>
                <th scope="col" className="py-2.5 px-4">Feature</th>
                <th scope="col" className="py-2.5 px-4">State</th>
                <th scope="col" className="py-2.5 px-4 text-right">OK · failed</th>
                <th scope="col" className="py-2.5 px-4">Last success</th>
                <th scope="col" className="py-2.5 px-4">Last failure</th>
                <th scope="col" className="py-2.5 px-4">If it fails</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {modules.map((m) => (
                <tr key={m.id} className="align-top">
                  <th scope="row" className="py-2.5 px-4 text-left font-semibold text-foreground">{m.name}<span className="block text-[10px] font-normal text-muted-foreground">{m.source}</span></th>
                  <td className="py-2.5 px-4"><Badge t={m.status} /><span className="block mt-1 text-[10px] text-muted-foreground max-w-[220px]">{m.summary}</span></td>
                  <td className="py-2.5 px-4 text-right font-mono">{m.succeeded24h} · {m.failed24h}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{when(m.lastSuccessAt)}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{when(m.lastFailureAt)}</td>
                  <td className="py-2.5 px-4 text-[11px] text-muted-foreground max-w-[240px]">{m.impact}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-2.5 text-[10px] text-muted-foreground border-t border-border">
          Pages and sign-in aren&apos;t covered: the app records no per-request errors to judge them by. Use your hosting provider&apos;s logs for those.
        </p>
      </section>

      {/* API routes */}
      <section aria-labelledby="routes-h" className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden" data-testid="route-health">
        <div className="p-4 border-b border-border">
          <h2 id="routes-h" className="text-sm font-bold text-foreground">API routes (last 24 hours)</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Outcomes of routes wrapped by the request guard. Failed = server error or exception. Pages and server actions aren&apos;t recorded here.</p>
        </div>
        {!routes.available ? (
          <p className="p-4 text-xs text-muted-foreground">Not available: route stats need migration 0033.</p>
        ) : routes.routes.length === 0 ? (
          <p className="p-4 text-xs text-muted-foreground">No requests recorded in the last 24 hours.</p>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">API route outcomes</caption>
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr><th scope="col" className="py-2.5 px-4">Route</th><th scope="col" className="py-2.5 px-4">State</th><th scope="col" className="py-2.5 px-4 text-right">Requests · failed · slow</th><th scope="col" className="py-2.5 px-4 text-right">Avg time</th><th scope="col" className="py-2.5 px-4">Last failure</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {routes.routes.map((r) => (
                  <tr key={r.route} className="align-top">
                    <th scope="row" className="py-2.5 px-4 text-left font-mono font-normal text-foreground">{r.route}</th>
                    <td className="py-2.5 px-4"><Badge t={r.status} /></td>
                    <td className="py-2.5 px-4 text-right font-mono">{r.requests} · {r.failed} ({r.errorRate}%) · {r.slow}</td>
                    <td className="py-2.5 px-4 text-right font-mono">{r.avgMs === null ? "—" : `${r.avgMs} ms`}</td>
                    <td className="py-2.5 px-4 text-[11px] text-muted-foreground">{r.lastFailedAt ? <>{fullTimestamp(r.lastFailedAt)} · {r.lastError}{r.lastRequestId && <span className="block font-mono">request {r.lastRequestId}</span>}</> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="text-[11px] text-muted-foreground" data-testid="check-history">
        {!history.available
          ? "Scheduled check history isn't available (migration 0033 not applied)."
          : history.lastRunAt
            ? <>Last scheduled check: {fullTimestamp(history.lastRunAt)}{historyStale && <strong className="text-amber-800 dark:text-amber-400"> · stale: the schedule may have stopped</strong>}.</>
            : "No scheduled check has run yet: schedule /api/internal/health-run."}
      </p>

      {lcKind && (
        <p role={lcKind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-2.5 text-xs ${lcKind === "error" ? "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"}`}>{lcMsg.join(":")}</p>
      )}

      {/* Incidents */}
      <section id="incidents" aria-labelledby="incidents-h" className="rounded-2xl border border-border bg-card shadow-2xs overflow-hidden scroll-mt-20">
        <div className="p-4 border-b border-border space-y-2">
          <h2 id="incidents-h" className="text-sm font-bold text-foreground">Incidents (last 7 days)</h2>
          <p className="text-[11px] text-muted-foreground">Repeated failures with the same error are grouped. Active = failed in the last 24 hours. Quiet = no new failure since, not confirmed fixed. Resolving an incident records how it was handled; it doesn&apos;t change any health status, which is always measured.</p>
          <nav aria-label="Filter incidents" className="flex flex-wrap gap-1.5 text-[11px]">
            {[["All", {}], ["Active", { status: "active" }], ["Quiet", { status: "quiet" }], ["Critical", { severity: "critical" }], ["Warning", { severity: "warning" }]].map(([label, over]) => (
              <Link key={label as string} href={qs({ severity: undefined, status: undefined, ...(over as Partial<SP>) })} className="px-2.5 py-1 rounded-md border border-border hover:bg-accent">{label as string}</Link>
            ))}
            {modulesInIncidents.map((m) => (
              <Link key={m} href={qs({ module: sp.module === m ? undefined : m })} aria-current={sp.module === m ? "true" : undefined} className={`px-2.5 py-1 rounded-md border ${sp.module === m ? "border-primary text-primary" : "border-border hover:bg-accent"}`}>{m}</Link>
            ))}
          </nav>
        </div>
        {shown.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground" data-testid="no-incidents">{incidents.length ? "No incidents match these filters." : "No failures recorded in the last 7 days."}</p>
        ) : (
          <ul className="divide-y divide-border/60" data-testid="incident-list">
            {shown.map((i) => (
              <li key={i.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${i.severity === "critical" ? TONE.critical.badge : TONE.degraded.badge}`}>{i.severity === "critical" ? "Critical" : "Warning"}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">{i.status === "active" ? "Active" : "Quiet"}</span>
                  <span className="font-semibold text-foreground">{i.module}</span>
                  <span className="text-muted-foreground">· {i.occurrences} failure(s) · first {fullTimestamp(i.firstSeen)} · last {fullTimestamp(i.lastSeen)}</span>
                  <Link href={`/admin/system?incident=${i.id}#incident-detail`} className="ml-auto text-[11px] font-semibold text-primary hover:underline">Details</Link>
                </div>
                <p className="mt-1 text-[11px] font-mono text-rose-700 dark:text-rose-400 break-words">Latest error: {i.latestError}</p>
                {lifecycle.get(i.id) ? (
                  <form action={updateIncidentAction} className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                    <input type="hidden" name="fingerprint" value={i.id} />
                    <span className="text-muted-foreground">
                      Handling: <strong className="text-foreground capitalize">{lifecycle.get(i.id)!.state}</strong>
                      {lifecycle.get(i.id)!.assignedTo && <> · {lifecycle.get(i.id)!.assignedTo}</>}
                    </span>
                    <label className="sr-only" htmlFor={`st-${i.id}`}>New state</label>
                    <select id={`st-${i.id}`} name="state" className="min-h-8 rounded-md border border-border bg-background px-2">
                      {INCIDENT_STATES.filter((s) => canMove(lifecycle.get(i.id)!.state, s)).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <label className="sr-only" htmlFor={`nt-${i.id}`}>Note</label>
                    <input id={`nt-${i.id}`} name="note" placeholder="Note (required to resolve)" className="min-h-8 rounded-md border border-border bg-background px-2 flex-1 min-w-[160px]" />
                    <button type="submit" className="min-h-8 px-3 rounded-md bg-primary text-primary-foreground font-semibold">Update</button>
                  </form>
                ) : stored.available ? (
                  <p className="mt-1 text-[10px] text-muted-foreground">Not tracked yet: incidents are recorded by the next scheduled health run.</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {selected && (
        <section id="incident-detail" aria-labelledby="incident-detail-h" className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-3 scroll-mt-20" data-testid="incident-detail">
          <h2 id="incident-detail-h" className="text-sm font-bold text-foreground">{selected.module}: {selected.occurrences} failure(s)</h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div><dt className="text-muted-foreground">First seen</dt><dd className="font-mono">{fullTimestamp(selected.firstSeen)}</dd></div>
            <div><dt className="text-muted-foreground">Last seen</dt><dd className="font-mono">{fullTimestamp(selected.lastSeen)}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Latest error (evidence, not a confirmed cause)</dt><dd className="font-mono text-rose-700 dark:text-rose-400 break-words">{selected.latestError}</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">Cause</dt><dd className="text-foreground">Not determined. Investigate with the record ids below.</dd></div>
            <div className="sm:col-span-2"><dt className="text-muted-foreground">What to do</dt><dd className="text-foreground">{selected.remediation}</dd></div>
          </dl>
          <div>
            <h3 className="text-xs font-semibold text-foreground">Most recent affected records</h3>
            <ul className="mt-1 space-y-0.5 text-[11px] font-mono text-muted-foreground">
              {selected.recentRecords.map((r) => <li key={r.id}>{r.id} · {fullTimestamp(r.at)}</li>)}
            </ul>
          </div>
          <Link href="/admin/system#incidents" className="text-[11px] font-semibold text-primary hover:underline">Close</Link>
        </section>
      )}

      {/* Jobs */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Latest background jobs</h2>
        </div>
        {recentJobs.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">No background jobs yet.</div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Latest background jobs</caption>
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-2.5 px-4">Job</th>
                  <th scope="col" className="py-2.5 px-4">Status</th>
                  <th scope="col" className="py-2.5 px-4">Attempts</th>
                  <th scope="col" className="py-2.5 px-4">Last error</th>
                  <th scope="col" className="py-2.5 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {recentJobs.map((j) => (
                  <tr key={j.id} className="align-top">
                    <td className="py-2.5 px-4"><span className="font-medium text-foreground">{j.type.replaceAll("_", " ")}</span><span className="block font-mono text-[10px] text-muted-foreground">#{j.id.slice(0, 8)}</span></td>
                    <td className="py-2.5 px-4"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground">{j.status.replaceAll("_", " ")}</span></td>
                    <td className="py-2.5 px-4 font-mono text-muted-foreground">{j.attempts}</td>
                    <td className="py-2.5 px-4 text-[11px] text-rose-700 dark:text-rose-400 max-w-[320px] break-words">{j.lastError ? sanitizeError(j.lastError) : ""}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-[11px] text-muted-foreground whitespace-nowrap">{fullTimestamp(j.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
