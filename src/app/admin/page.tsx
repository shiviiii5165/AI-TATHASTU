import "./intelligence/intelligence.css";

import { ArrowUpRight, CheckCircle2, LifeBuoy, Mail } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";

import { BarList, Card, Columns, Kpi, SLOT } from "@/components/admin/intelligence/charts";
import { requireAdmin } from "@/lib/admin";
import { getAiBudgetStatus, getAiProviderUsage } from "@/lib/admin/ai-ops";
import { listAdminAudits } from "@/lib/admin/audit";
import { actionRequired, aiUsageTrend, growthTrends, platformSummary } from "@/lib/admin/overview";
import { getAdminContext } from "@/lib/admin/rbac";
import { type HealthStatus, platformChecks } from "@/lib/admin/health";
import { displayIp, fullTimestamp } from "@/lib/admin/summaries";

const HEALTH_BADGE: Record<HealthStatus, { label: string; dot: string; cls: string }> = {
  healthy: { label: "Healthy", dot: "bg-emerald-500", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" },
  warning: { label: "Needs attention", dot: "bg-amber-500", cls: "bg-amber-500/10 text-amber-800 dark:text-amber-400" },
  critical: { label: "Problem", dot: "bg-rose-500", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400" },
  not_monitored: { label: "Not monitored", dot: "bg-muted-foreground/50", cls: "bg-muted text-muted-foreground" },
};

export const metadata = {
  title: "Overview · Admin Control Center",
  robots: { index: false },
};

export const instant = false;

const fmt = (n: number) => n.toLocaleString("en-IN");
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "—");
const usd = (n: number) => `$${n.toFixed(2)}`;
const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" });

/**
 * The admin control center. Read-only: it aggregates existing records and never seeds, recomputes or calls an AI
 * provider. Each card states its population; links open the page where the item can be acted on.
 */
export default async function AdminOverviewPage() {
  await connection();
  const user = await requireAdmin();
  const ctx = await getAdminContext(user);

  // Students, tickets, spend and the audit log together are super-admin only; other roles use their own pages.
  if (!ctx?.isSuperAdmin) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Admin Control Center</h1>
        <p className="text-sm text-muted-foreground">
          Signed in as {ctx?.role.replaceAll("_", " ")}. Use the menu to open the sections your role can access. Others show as not found.
        </p>
      </div>
    );
  }

  const [checks, summary, growth, actions, aiTrend, providers, budget, auditsData] = await Promise.all([
    platformChecks(),
    platformSummary(),
    growthTrends(12),
    actionRequired(),
    aiUsageTrend(6),
    getAiProviderUsage(),
    getAiBudgetStatus(),
    listAdminAudits({ limit: 8 }),
  ]);
  const generatedAt = new Date();
  const budgetLimit = Number(budget.budgetUsd);

  const actionItems: { label: string; detail: string; count: number; href?: string; severity: "critical" | "warning" }[] = [
    { label: "Open urgent or high-priority tickets", detail: "Not resolved or closed", count: actions.urgentTickets, href: "/admin/tickets", severity: "critical" },
    { label: "Tickets past their resolution due date", detail: "SLA target from ticket priority", count: actions.overdueTickets, href: "/admin/tickets?overdue=1", severity: "critical" },
    { label: "Background jobs failed in the last 24 hours", detail: `${fmt(actions.failedJobsTotal)} failed jobs kept in total`, count: actions.failedJobs24h, href: "/admin/system", severity: "critical" },
    { label: "Background jobs waiting over 15 minutes", detail: "Queued and due, not yet picked up", count: actions.staleQueuedJobs, href: "/admin/system", severity: "warning" },
    { label: "Background jobs needing review", detail: "Stopped and marked for a person to check", count: actions.jobsNeedingReview, href: "/admin/system", severity: "warning" },
    { label: "Emails that failed to send", detail: "All delivery attempts used", count: actions.emailsFailed, href: "/admin/emails/deliveries", severity: "critical" },
    { label: "Emails waiting to be sent", detail: "In the delivery outbox", count: actions.emailsQueued, href: "/admin/emails/deliveries", severity: "warning" },
    { label: "Institutions waiting for review", detail: "Typed by users under \"Other\"", count: actions.pendingInstitutions, href: "/admin/institutions", severity: "warning" },
    { label: "Account deletions with failed steps", detail: `${fmt(actions.deletionsInProgress)} deletion(s) not yet complete`, count: actions.deletionsFailing, severity: "critical" },
  ];
  const needsAttention = actionItems.filter((a) => a.count > 0);

  return (
    <div className="si-root space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">Platform Overview</h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Accounts, onboarding, support, background work and AI spend, counted from the database when this page loaded ({fullTimestamp(generatedAt)}).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/tickets/new" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-2xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors">
            <LifeBuoy className="size-3.5" /> Create ticket
          </Link>
          <Link href="/admin/emails/templates" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 transition-colors">
            <Mail className="size-3.5" /> Email templates
          </Link>
        </div>
      </div>

      {/* A. Platform summary */}
      <section aria-labelledby="ov-summary" className="space-y-3">
        <h2 id="ov-summary" className="sr-only">Platform summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3" data-testid="platform-summary">
          <Kpi label="Registered accounts" value={fmt(summary.total)} sub={`${fmt(summary.students)} students · ${fmt(summary.faculty)} faculty · ${fmt(summary.alumni)} alumni`} color={SLOT(0)} href="/admin/students" />
          <Kpi label="New in 30 days" value={fmt(summary.new30)} sub="Accounts created in the last 30 days" color={SLOT(6)} href="/admin/students?sort=newest" />
          <Kpi label="Finished onboarding" value={fmt(summary.onboarded)} sub={`${pct(summary.onboarded, summary.total)} · ${fmt(summary.notOnboarded)} not finished`} color={SLOT(2)} href="/admin/students?onboarding=incomplete" />
          <Kpi label="Uploaded a resume" value={fmt(summary.resumes)} sub={`${pct(summary.resumes, summary.total)} of accounts`} color={SLOT(3)} />
          <Kpi label="Connected accounts" value={fmt(summary.connected)} sub="Users with at least one linked account (GitHub, LinkedIn…)" color={SLOT(1)} />
          <Kpi label="Open tickets" value={fmt(actions.openTickets)} sub={actions.urgentTickets ? `${fmt(actions.urgentTickets)} open urgent/high priority` : "Not resolved or closed"} color={SLOT(7)} href="/admin/tickets" />
        </div>
        <p className="text-[10px] text-muted-foreground">All counts exclude deleted accounts.</p>
      </section>

      {/* B. Action required + status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Needs attention" subtitle="Counted across all records. Each row opens the page where it can be handled." className="lg:col-span-2">
          {needsAttention.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl border border-dashed border-border px-4 py-5 text-xs text-muted-foreground" data-testid="nothing-pending">
              <CheckCircle2 aria-hidden className="size-4" /> Nothing in these queues needs action right now.
            </p>
          ) : (
            <ul className="divide-y divide-border/60" data-testid="action-required">
              {needsAttention.map((a) => {
                const body = (
                  <>
                    <span className={`flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold tabular-nums ${a.severity === "critical" ? "bg-rose-500/10 text-rose-700 dark:text-rose-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>{fmt(a.count)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-foreground">{a.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{a.detail}</span>
                    </span>
                    {a.href && <ArrowUpRight aria-hidden className="size-3.5 text-muted-foreground" />}
                  </>
                );
                return (
                  <li key={a.label}>
                    {a.href ? (
                      <Link href={a.href} className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-accent/40 focus-visible:outline-2 focus-visible:outline-offset-2 px-1">{body}</Link>
                    ) : (
                      <div className="flex items-center gap-3 py-2.5 px-1">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Platform status" subtitle="Checks run when this page loaded." action={<Link href="/admin/system" className="text-[11px] font-semibold text-primary hover:underline">Details</Link>}>
          <ul data-testid="operational-status" className="space-y-1.5">
            {checks.components.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-foreground">{c.name}</span>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${HEALTH_BADGE[c.status].cls}`}>
                  <span aria-hidden className={`size-1.5 rounded-full ${HEALTH_BADGE[c.status].dot}`} />
                  {HEALTH_BADGE[c.status].label}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* C. Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="New accounts per month" subtitle="Last 12 months, by account creation date." source="users.created_at" className="lg:col-span-2">
          <Columns items={growth.registrations.map((r) => ({ label: monthLabel(r.month), value: r.value }))} color={SLOT(0)} unit=" accounts" />
        </Card>
        <Card title="Connected accounts by source" subtitle="Users with each account currently linked." source="connections (status connected)">
          <BarList colorBy="slot" items={summary.connectionsBySource.map((c) => ({ label: c.source, value: c.users, display: fmt(c.users) }))} />
        </Card>
        <Card title="Onboarding completed per month" subtitle="By the date each user finished onboarding." source="onboarding_state.completed_at">
          <Columns items={growth.onboardings.map((r) => ({ label: monthLabel(r.month), value: r.value }))} color={SLOT(2)} unit=" users" />
        </Card>
        <Card title="Resume uploads per month" subtitle="Every resume file uploaded, by upload date." source="files (kind resume)">
          <Columns items={growth.resumeUploads.map((r) => ({ label: monthLabel(r.month), value: r.value }))} color={SLOT(3)} unit=" uploads" />
        </Card>
        <Card title="Student activity" subtitle="Day-to-day activity has no recorded event source yet, so no activity trend is shown.">
          <p className="text-xs text-muted-foreground">Not available.</p>
        </Card>
      </div>

      {/* D. AI usage and cost */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card
          title="AI spend this month"
          subtitle="Our own calculation, not the provider's invoice."
          source="ai_spend_counters, ai_cost_budgets"
          action={<Link href="/admin/ai-ops/costs" className="text-[11px] font-semibold text-primary hover:underline">Budgets</Link>}
        >
          <div className="text-2xl font-extrabold tabular-nums text-foreground">{usd(budget.usedUsd)} <span className="text-sm font-semibold text-muted-foreground">of {usd(budgetLimit)}</span></div>
          <div className="mt-2 h-2 rounded-full" style={{ background: "var(--si-track)" }}>
            <div className="h-2 rounded-full" style={{ width: `${budgetLimit > 0 ? Math.min(100, (budget.usedUsd / budgetLimit) * 100) : 0}%`, background: budget.usedUsd >= budgetLimit * (budget.warningThresholdPercent / 100) ? "var(--si-8)" : SLOT(6) }} />
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div><dt className="text-muted-foreground">Measured</dt><dd className="font-mono font-semibold text-foreground">{usd(budget.meteredUsd)}</dd></div>
            <div><dt className="text-muted-foreground">Estimated</dt><dd className="font-mono font-semibold text-foreground">{usd(budget.estimatedUsd)}</dd></div>
            <div><dt className="text-muted-foreground">Reserved</dt><dd className="font-mono font-semibold text-foreground">{usd(budget.reservedUsd)}</dd></div>
          </dl>
          <p className="mt-2 text-[10px] text-muted-foreground">Measured: tokens the provider reported. Estimated: charged in full when no usage was reported.</p>
        </Card>

        <Card title="AI providers this month" subtitle="Calls the worker recorded, with failures and average response time." source="ai_usage_ledger" className="lg:col-span-2"
          action={<Link href="/admin/ai-ops/providers" className="text-[11px] font-semibold text-primary hover:underline">Details</Link>}>
          {providers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No AI calls recorded this month.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">AI provider usage this month</caption>
                <thead className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <tr><th scope="col" className="py-2">Provider</th><th scope="col" className="py-2 text-right">Calls</th><th scope="col" className="py-2 text-right">Failed</th><th scope="col" className="py-2 text-right">Avg time</th><th scope="col" className="py-2 text-right">Cost</th></tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {providers.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className="py-2 font-semibold text-foreground">{p.name}</th>
                      <td className="py-2 text-right font-mono">{fmt(p.callsThisMonth)}</td>
                      <td className={`py-2 text-right font-mono ${p.errorRate >= 10 ? "text-rose-600 dark:text-rose-400 font-semibold" : ""}`}>{p.errorRate}%</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">{p.avgLatencyMs === null ? "—" : `${fmt(p.avgLatencyMs)} ms`}</td>
                      <td className="py-2 text-right font-mono">{usd(p.costThisMonth)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="AI calls per month" subtitle="Last 6 months of settled calls. Provider fallback isn't recorded separately, so it isn't shown." source="ai_usage_ledger (settled)" className="lg:col-span-2">
          <Columns items={aiTrend.map((m) => ({ label: monthLabel(m.month), value: m.calls }))} color={SLOT(6)} unit=" calls" />
        </Card>
        <Card title="AI cost per month" subtitle="Measured and estimated kept apart." source="ai_usage_ledger (settled)">
          <table className="w-full text-xs">
            <caption className="sr-only">AI cost per month</caption>
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th scope="col" className="text-left py-1">Month</th><th scope="col" className="text-right py-1">Measured</th><th scope="col" className="text-right py-1">Estimated</th><th scope="col" className="text-right py-1">Failed calls</th></tr></thead>
            <tbody className="divide-y divide-border/60 font-mono">
              {aiTrend.map((m) => (
                <tr key={m.month}><th scope="row" className="py-1 text-left font-sans font-medium text-foreground">{monthLabel(m.month)}</th><td className="py-1 text-right">{usd(m.meteredUsd)}</td><td className="py-1 text-right">{usd(m.estimatedUsd)}</td><td className="py-1 text-right">{fmt(m.failed)}</td></tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* E. Recent administrative activity */}
      <Card title="Recent administrative actions" subtitle="The latest entries in the audit log." source="admin_audit_logs" action={<Link href="/admin/logs" className="text-[11px] font-semibold text-primary hover:underline">All logs</Link>}>
        {auditsData.logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">No administrative actions recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Recent administrative actions</caption>
              <thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th scope="col" className="pb-2">Who</th><th scope="col" className="pb-2">Action</th><th scope="col" className="pb-2">Resource</th><th scope="col" className="pb-2">IP address</th><th scope="col" className="pb-2 text-right">When</th></tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {auditsData.logs.map((log) => (
                  <tr key={log.id} className="text-[11px]">
                    <td className="py-2.5 font-semibold text-foreground">{log.actorEmail}</td>
                    <td className="py-2.5"><span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono">{log.action}</span></td>
                    <td className="py-2.5 text-muted-foreground font-mono">{log.resource}</td>
                    <td className="py-2.5 text-muted-foreground font-mono">{displayIp(log.ipAddress)}</td>
                    <td className="py-2.5 text-right text-muted-foreground font-mono whitespace-nowrap">{fullTimestamp(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

    </div>
  );
}
