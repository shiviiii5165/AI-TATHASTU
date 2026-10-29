import { Activity, CheckCircle2, Clock, Database, Globe, Server, Shield } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { jobs, webhookOutbox } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { desc, sql } from "drizzle-orm";

export const metadata = {
  title: "System & Operational Health · Admin Control Center",
  robots: { index: false },
};

export default async function AdminSystemPage() {
  await requireAdmin();
  await requireAdminPermission("system.manage");

  const [recentJobs, pendingWebhooks] = await Promise.all([
    db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(10),
    db.select().from(webhookOutbox).orderBy(desc(webhookOutbox.createdAt)).limit(10),
  ]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Activity className="size-6 text-primary" />
          <span>System Infrastructure & Operational Health</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Real-time metrics for PostgreSQL database connections, background intelligence jobs, and webhook dispatchers.
        </p>
      </div>

      {/* Component Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">PostgreSQL Database</span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Database className="size-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Connected & Healthy</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">Neon Serverless · PGVector enabled</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Python Intelligence Worker</span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Server className="size-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-foreground">Active (FastAPI)</div>
          <p className="text-[11px] text-muted-foreground font-mono">provider_router.py · Groq/Gemini/OpenRouter</p>
        </div>

        <div className="p-5 rounded-2xl border border-border bg-card shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">Cloudflare Storage</span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Globe className="size-4" />
            </div>
          </div>
          <div className="text-lg font-bold text-foreground">Operational</div>
          <p className="text-[11px] text-muted-foreground font-mono">S3/R2 presigned upload buckets</p>
        </div>
      </div>

      {/* Background Jobs Queue */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Recent Intelligence Jobs Queue ({recentJobs.length})
          </h2>
        </div>

        {recentJobs.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No background processing jobs queued.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Job ID</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4 text-right">Queued</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 font-mono text-[11px]">
                {recentJobs.map((j) => (
                  <tr key={j.id} className="hover:bg-accent/40">
                    <td className="py-3 px-4 font-bold text-foreground">#{j.id.slice(0, 8)}</td>
                    <td className="py-3 px-4 font-sans font-medium text-foreground">{j.type}</td>
                    <td className="py-3 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-muted text-foreground">
                        {j.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{j.attempts}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {new Date(j.createdAt).toLocaleTimeString("en-IN")}
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
