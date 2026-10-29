import { FileText, Filter, Search, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { listAdminAudits } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";

export const metadata = {
  title: "Security Audit Trail · Admin Control Center",
  robots: { index: false },
};

interface LogsPageProps {
  searchParams: Promise<{
    resource?: string;
  }>;
}

export default async function AdminLogsPage({ searchParams }: LogsPageProps) {
  await requireAdmin();
  await requireAdminPermission("audit.read");

  const params = await searchParams;
  const { logs, total } = await listAdminAudits({
    resource: params.resource,
    limit: 100,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="size-6 text-primary" />
          <span>Security Audit Trail & Privileged Logs</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Immutable ledger of all administrative mutations, role updates, and student account actions.
        </p>
      </div>

      {/* Logs Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            No privileged administrative mutations recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Actor Email</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Target Resource</th>
                  <th className="py-3 px-4">IP Address</th>
                  <th className="py-3 px-4">Details</th>
                  <th className="py-3 px-4 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-accent/40 transition-colors font-mono text-[11px]">
                    <td className="py-3 px-4 font-sans font-semibold text-foreground">
                      {log.actorEmail}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-muted text-foreground font-mono font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {log.resource}
                      {log.targetId && (
                        <span className="text-[10px] text-muted-foreground/80 block font-mono">
                          #{log.targetId.slice(0, 8)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{log.ipAddress || "127.0.0.1"}</td>
                    <td className="py-3 px-4 text-muted-foreground max-w-[200px] truncate font-sans text-[11px]">
                      {JSON.stringify(log.details)}
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground font-mono">
                      {new Date(log.createdAt).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
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

