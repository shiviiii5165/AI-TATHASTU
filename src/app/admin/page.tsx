import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Cpu,
  FileText,
  LifeBuoy,
  Mail,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";

import { requireAdmin } from "@/lib/admin";
import { getAiBudgetStatus, getAiProviderHealthSummary } from "@/lib/admin/ai-ops";
import { listAdminAudits } from "@/lib/admin/audit";
import { seedStarterTemplates } from "@/lib/admin/email-engine";
import { getAdminContext } from "@/lib/admin/rbac";
import { listStudents } from "@/lib/admin/students";
import { listSupportTickets } from "@/lib/admin/tickets";

export const metadata = {
  title: "Overview · Admin Control Center",
  robots: { index: false },
};

export const instant = false;

export default async function AdminOverviewPage() {
  await connection();
  const user = await requireAdmin();
  const ctx = await getAdminContext(user);

  // Initialize starter fixtures/seed if empty (idempotent)
  await seedStarterTemplates();

  const [studentsData, ticketsData, providers, budget, auditsData] = await Promise.all([
    listStudents({ limit: 5 }),
    listSupportTickets({ limit: 5 }),
    getAiProviderHealthSummary(),
    getAiBudgetStatus(),
    listAdminAudits({ limit: 5 }),
  ]);

  const openTicketsCount = ticketsData.tickets.filter((t) => t.status !== "closed" && t.status !== "resolved").length;
  const urgentTicketsCount = ticketsData.tickets.filter((t) => t.priority === "urgent" || t.priority === "high").length;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground uppercase tracking-wider">
            <span>Admin Control Center</span>
            <span>·</span>
            <span className="text-primary font-semibold">{ctx?.role.replace("_", " ")}</span>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
            Platform Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Real-time telemetry, support queue, student directory, and AI model operations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/tickets/new"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-2xs hover:bg-primary/90 transition-colors"
          >
            <LifeBuoy className="size-3.5" />
            <span>Create Ticket</span>
          </Link>
          <Link
            href="/admin/emails/templates"
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors"
          >
            <Mail className="size-3.5" />
            <span>Template Studio</span>
          </Link>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Registered Students</span>
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Users className="size-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {studentsData.total.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
            <span>across all personas</span>
          </div>
        </div>

        {/* Support Queue */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Open Tickets</span>
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <LifeBuoy className="size-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            {ticketsData.total.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {urgentTicketsCount > 0 ? (
              <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1">
                <AlertCircle className="size-3" />
                {urgentTicketsCount} urgent/high priority
              </span>
            ) : (
              <span className="text-muted-foreground">{openTicketsCount} awaiting agent action</span>
            )}
          </div>
        </div>

        {/* AI Budget */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Monthly AI Budget</span>
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <BarChart3 className="size-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-foreground">
            ${budget.spentUsd} / ${budget.budgetUsd}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
              {Math.round((Number(budget.spentUsd) / Number(budget.budgetUsd)) * 100)}%
            </span>
            <span>utilized this billing period</span>
          </div>
        </div>

        {/* System Health */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Operational Pulse</span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            100% OK
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            <span>All AI pools & outbox nominal</span>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Support Queue & AI Provider Pulse */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Support Tickets Queue (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-foreground">Recent Support Queue</h2>
              <p className="text-xs text-muted-foreground">Incoming inquiries, SLA status, and assignments</p>
            </div>
            <Link
              href="/admin/tickets"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
            >
              <span>View All</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          {ticketsData.tickets.length === 0 ? (
            <div className="py-12 text-center rounded-xl border border-dashed border-border/80">
              <LifeBuoy className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">No support tickets currently in queue.</p>
              <Link
                href="/admin/tickets/new"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary"
              >
                Create test ticket →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground font-semibold">
                    <th className="pb-2.5">Ticket #</th>
                    <th className="pb-2.5">Subject</th>
                    <th className="pb-2.5">Priority</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 text-right">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {ticketsData.tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-accent/40 transition-colors">
                      <td className="py-3 font-mono font-bold text-foreground">
                        <Link href={`/admin/tickets/${t.id}`} className="hover:text-primary transition-colors">
                          {t.ticketNumber}
                        </Link>
                      </td>
                      <td className="py-3 max-w-[200px] truncate text-foreground font-medium">
                        {t.subject}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            t.priority === "urgent"
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : t.priority === "high"
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground capitalize">
                          {t.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground font-mono">
                        {new Date(t.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* AI Provider Telemetry Cards (1 Col) */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-foreground">AI Gateway Status</h2>
              <p className="text-xs text-muted-foreground">Provider pools & circuit breaker state</p>
            </div>
            <Link
              href="/admin/ai-ops/providers"
              className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
            >
              <span>Manage</span>
              <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {providers.map((p) => (
              <div
                key={p.id}
                className="p-3.5 rounded-xl border border-border/70 bg-background/60 hover:bg-background transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs text-foreground flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-primary" />
                    {p.name}
                  </span>
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      p.healthStatus === "healthy"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {p.healthStatus}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground font-mono mt-2">
                  <span>Avg Latency: {p.avgLatencyMs}ms</span>
                  <span>Error: {p.errorRate}%</span>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 border-t border-border/80">
            <Link
              href="/admin/ai-ops/costs"
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-accent/70 hover:bg-accent text-foreground text-xs font-semibold transition-colors"
            >
              <BarChart3 className="size-3.5" />
              <span>View Cost Breakdown</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Audit Trail */}
      <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-foreground">Privileged Action Audit Trail</h2>
            <p className="text-xs text-muted-foreground">Immutable log of administrative operations and policy updates</p>
          </div>
          <Link
            href="/admin/logs"
            className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
          >
            <span>All Logs</span>
            <ArrowUpRight className="size-3" />
          </Link>
        </div>

        {auditsData.logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            No privileged administrative mutations recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground font-semibold">
                  <th className="pb-2">Actor</th>
                  <th className="pb-2">Action</th>
                  <th className="pb-2">Resource</th>
                  <th className="pb-2">IP Address</th>
                  <th className="pb-2 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {auditsData.logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/30 font-mono text-[11px]">
                    <td className="py-2.5 font-sans font-semibold text-foreground">{log.actorEmail}</td>
                    <td className="py-2.5">
                      <span className="px-1.5 py-0.5 rounded bg-muted text-foreground font-mono">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-muted-foreground">{log.resource}</td>
                    <td className="py-2.5 text-muted-foreground">{log.ipAddress || "127.0.0.1"}</td>
                    <td className="py-2.5 text-right text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
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
