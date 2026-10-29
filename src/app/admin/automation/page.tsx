import { Bell, Clock, Sliders, Zap } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "Automation & SLA Rules · Admin Control Center",
  robots: { index: false },
};

export default async function AdminAutomationPage() {
  await requireAdmin();
  await requireAdminPermission("support.rules.manage");

  const rules = [
    {
      id: "sla_urgent",
      name: "Urgent Priority Escalation Alert",
      event: "ticket.created",
      condition: "priority == 'urgent'",
      action: "Enqueue SLA warning email after 1h without agent reply",
      enabled: true,
    },
    {
      id: "sla_high",
      name: "High Priority First-Response Warning",
      event: "ticket.created",
      condition: "priority == 'high'",
      action: "Send Slack alert to #support-leads after 4h",
      enabled: true,
    },
    {
      id: "auto_close",
      name: "Auto-Close Inactive Resolved Tickets",
      event: "ticket.resolved",
      condition: "days_since_resolved >= 2",
      action: "Transition status from 'resolved' to 'closed'",
      enabled: true,
    },
    {
      id: "ai_failure_alert",
      name: "Circuit Breaker Alert Dispatch",
      event: "ai.circuit_breaker_tripped",
      condition: "consecutive_failures >= 3",
      action: "Notify AI Ops engineering team via email and system log",
      enabled: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Zap className="size-6 text-primary" />
          <span>Notification Rules & SLA Automation</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Event-to-notification policies, SLA breach monitors, and automated ticket state transitions.
        </p>
      </div>

      {/* Rules Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Active Automation Policies ({rules.length})
          </h2>
        </div>

        <div className="divide-y divide-border/60">
          {rules.map((r) => (
            <div key={r.id} className="p-4 sm:p-5 flex items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <div className="font-bold text-sm text-foreground flex items-center gap-2">
                  <span>{r.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted">
                    {r.event}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">{r.action}</p>
                <div className="text-[11px] font-mono text-primary font-medium">Condition: {r.condition}</div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

