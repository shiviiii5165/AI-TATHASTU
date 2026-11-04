import { Cpu } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { getAiProviderUsage } from "@/lib/admin/ai-ops";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "AI Providers · Admin Control Center",
  robots: { index: false },
};

export default async function AdminAiProvidersPage() {
  await requireAdmin();
  await requireAdminPermission("ai.providers.read");

  const providers = await getAiProviderUsage();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Cpu className="size-6 text-primary" />
            <span>AI Provider Calls</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Every paid call the worker recorded this UTC month. Which keys and models are set up lives in the worker&apos;s environment on Render, not here.
          </p>
        </div>

        <Link
          href="/admin/ai-ops/costs"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-border bg-card text-foreground text-xs font-semibold hover:bg-accent transition-colors shrink-0"
        >
          <span>View Cost Analytics →</span>
        </Link>
      </div>

      {providers.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">No provider calls recorded this month.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {providers.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
              <h2 className="text-base font-bold text-foreground">{p.name}</h2>
              <dl className="grid grid-cols-2 gap-2 mt-4 p-3 rounded-xl bg-background/60 border border-border/60 text-xs font-mono">
                {[
                  ["Calls", String(p.callsThisMonth)],
                  ["Failed or refused", `${p.errorRate}%`],
                  ["Avg latency", p.avgLatencyMs === null ? "No data" : `${p.avgLatencyMs} ms`],
                  ["Calculated cost", `$${p.costThisMonth.toFixed(2)}`],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-[10px] text-muted-foreground">{label}</dt>
                    <dd className="font-bold text-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
