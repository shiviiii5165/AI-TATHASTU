import { Activity, AlertTriangle, CheckCircle2, Cpu, Shield, Zap } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { getAiProviderHealthSummary } from "@/lib/admin/ai-ops";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "AI Providers & Models · Admin Control Center",
  robots: { index: false },
};

export default async function AdminAiProvidersPage() {
  await requireAdmin();
  await requireAdminPermission("ai.providers.read");

  const providers = await getAiProviderHealthSummary();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="size-6 text-primary" />
            <span>AI Gateway, Providers & Model Registry</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Multi-provider routing, circuit breakers, key pool rotation, and latency percentiles.
          </p>
        </div>

        <Link
          href="/admin/ai-ops/costs"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors shrink-0"
        >
          <span>View Cost Analytics →</span>
        </Link>
      </div>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {providers.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-muted">
                  {p.id}
                </span>
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    p.healthStatus === "healthy"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {p.healthStatus}
                </span>
              </div>

              <h2 className="text-base font-bold text-foreground">{p.name}</h2>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span>Circuit Breaker: {p.circuitBreakerState}</span>
              </div>

              {/* Metrics Box */}
              <div className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-background/60 border border-border/60 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Avg Latency</span>
                  <span className="font-bold text-foreground">{p.avgLatencyMs} ms</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Error Rate</span>
                  <span className="font-bold text-foreground">{p.errorRate}%</span>
                </div>
              </div>

              {/* Supported Models */}
              <div className="mt-4 space-y-2">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Hosted Models
                </span>
                <div className="space-y-1.5">
                  {p.models.map((m) => (
                    <div
                      key={m.id}
                      className="p-2 rounded-lg bg-muted/40 flex items-center justify-between text-xs"
                    >
                      <span className="font-medium text-foreground truncate max-w-[150px]">{m.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        ${m.inputCostPer1M}/M tok
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-border text-[11px] text-muted-foreground flex items-center justify-between font-mono">
              <span>Status: {p.status}</span>
              <span>Failover: Active</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

