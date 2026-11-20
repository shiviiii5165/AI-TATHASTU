import { AlertCircle, CheckCircle2, Clock, Mail, Send, XCircle } from "lucide-react";
import Link from "next/link";

import { OutboxControls } from "@/components/admin/outbox-controls";
import { db } from "@/db";
import { emailDeliveries } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { deliveryStatusCounts, fullTimestamp } from "@/lib/admin/summaries";
import { desc, eq } from "drizzle-orm";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { retryFailedDeliveryAction } from "../actions";

export const metadata = {
  title: "Delivery Outbox · Admin Control Center",
  robots: { index: false },
};

const STATUS_FILTERS = ["queued", "delivered", "failed"] as const;

export default async function AdminEmailDeliveriesPage({ searchParams }: { searchParams?: Promise<{ status?: string; retry?: string }> } = {}) {
  await requireAdmin();
  await requireAdminPermission("email.delivery.retry");
  const sp = (await searchParams) ?? {};
  const statusFilter = (STATUS_FILTERS as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;

  // The table lists the latest 50 (optionally of one status); the totals are aggregated across the whole outbox.
  const [deliveries, counts] = await Promise.all([
    db
      .select()
      .from(emailDeliveries)
      .where(statusFilter ? eq(emailDeliveries.status, statusFilter) : undefined)
      .orderBy(desc(emailDeliveries.createdAt))
      .limit(50),
    deliveryStatusCounts(),
  ]);

  const queuedCount = counts.queued;
  const deliveredCount = counts.delivered;
  const failedCount = counts.failed;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <Send className="size-6 text-primary" />
            <span>Email Delivery Outbox & Telemetry</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Durable transactional outbox, retry backoff ledger, and delivery tracking.
          </p>
        </div>

        <OutboxControls />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">Queued for Sending</span>
            <div className="text-2xl font-bold text-foreground mt-1">{queuedCount}</div>
          </div>
          <div className="size-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Clock className="size-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">Delivered Successfully</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
              {deliveredCount}
            </div>
          </div>
          <div className="size-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="size-4" />
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-muted-foreground">Delivery Failures</span>
            <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">{failedCount}</div>
          </div>
          <div className="size-9 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
            <XCircle className="size-4" />
          </div>
        </div>
      </div>

      {sp.retry === "queued" && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-2.5 text-xs text-emerald-800 dark:text-emerald-300">The email is back in the queue for one more attempt. It will be sent on the next outbox run, or when you press &quot;Process Due Deliveries&quot;.</p>}
      {sp.retry === "error" && <p role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/5 px-4 py-2.5 text-xs text-rose-800 dark:text-rose-300">That email couldn&apos;t be retried. Only failed emails can be retried.</p>}

      <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5 text-xs">
        {[undefined, ...STATUS_FILTERS].map((s) => (
          <Link
            key={s ?? "all"}
            href={s ? `/admin/emails/deliveries?status=${s}` : "/admin/emails/deliveries"}
            aria-current={s === statusFilter ? "page" : undefined}
            className={`px-3 py-1.5 rounded-lg font-medium capitalize ${s === statusFilter ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
          >
            {s ?? "All"}
          </Link>
        ))}
      </nav>

      <p className="text-xs text-muted-foreground" data-testid="delivery-totals-note">
        Totals cover all {counts.total.toLocaleString()} deliveries in the outbox. The table shows the latest {deliveries.length}{statusFilter ? ` ${statusFilter}` : ""}.
      </p>

      {/* Outbox Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {deliveries.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">
            No emails recorded in the delivery outbox.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Recipient</th>
                  <th className="py-3 px-4">Template / Subject</th>
                  <th className="py-3 px-4">Profile</th>
                  <th className="py-3 px-4">Attempts</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Queued At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {deliveries.map((d) => (
                  <tr key={d.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-medium text-foreground">{d.recipient}</td>
                    <td className="py-3.5 px-4 max-w-[260px] truncate text-foreground font-medium">
                      <div>{d.subject}</div>
                      {d.templateSlug && (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {d.templateSlug}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground capitalize">
                      {d.senderProfile}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-muted-foreground">
                      {d.attempts} / {d.maxAttempts}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          d.status === "delivered"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : d.status === "failed"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        }`}
                      >
                        {d.status}
                      </span>
                      {d.lastError && (
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 break-words max-w-[240px] mt-0.5">
                          {d.lastError}
                        </div>
                      )}
                      {d.status === "failed" && (
                        <form action={retryFailedDeliveryAction} className="mt-1">
                          <input type="hidden" name="id" value={d.id} />
                          <ConfirmSubmit
                            message={`Try sending this email to ${d.recipient} once more?`}
                            className="text-[11px] font-semibold text-primary hover:underline"
                          >
                            Retry
                          </ConfirmSubmit>
                        </form>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                      {fullTimestamp(d.createdAt)}
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

