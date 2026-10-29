import { AlertCircle, Filter, LifeBuoy, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { listSupportTickets, type TicketPriority, type TicketStatus } from "@/lib/admin/tickets";

export const metadata = {
  title: "Tickets & Support · Admin Control Center",
  robots: { index: false },
};

interface TicketsPageProps {
  searchParams: Promise<{
    status?: string;
    priority?: string;
    category?: string;
    q?: string;
  }>;
}

export default async function AdminTicketsPage({ searchParams }: TicketsPageProps) {
  await requireAdmin();
  await requireAdminPermission("support.tickets.read");

  const params = await searchParams;
  const statusFilter = (params.status as TicketStatus) || undefined;
  const priorityFilter = (params.priority as TicketPriority) || undefined;
  const searchQuery = params.q || undefined;

  const { tickets, total } = await listSupportTickets({
    status: statusFilter,
    priority: priorityFilter,
    query: searchQuery,
    limit: 50,
  });

  const statuses: { label: string; value?: TicketStatus }[] = [
    { label: "All Tickets" },
    { label: "New", value: "new" },
    { label: "Open", value: "open" },
    { label: "In Progress", value: "in_progress" },
    { label: "Waiting for Student", value: "waiting_student" },
    { label: "Escalated", value: "escalated" },
    { label: "Resolved", value: "resolved" },
    { label: "Closed", value: "closed" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="size-6 text-primary" />
            <span>Support Tickets & Operations</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Manage inquiries, assign workloads, enforce SLAs, and reply to students.
          </p>
        </div>

        <Link
          href="/admin/tickets/new"
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-2xs hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus className="size-4" />
          <span>New Ticket</span>
        </Link>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card border border-border p-3.5 rounded-2xl shadow-2xs">
        {/* Horizontal Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none text-xs">
          {statuses.map((tab) => {
            const isActive = tab.value === statusFilter || (!tab.value && !statusFilter);
            const queryParam = tab.value ? `?status=${tab.value}` : "/admin/tickets";

            return (
              <Link
                key={tab.label}
                href={tab.value ? `/admin/tickets?status=${tab.value}` : "/admin/tickets"}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Search Input */}
        <form method="GET" action="/admin/tickets" className="relative shrink-0 w-full lg:w-72">
          <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            name="q"
            defaultValue={searchQuery}
            placeholder="Search #ID, subject, email..."
            className="w-full bg-muted/60 focus:bg-background border border-border text-xs rounded-lg pl-8 pr-3 py-1.5 outline-none transition-colors"
          />
        </form>
      </div>

      {/* Tickets Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {tickets.length === 0 ? (
          <div className="py-16 text-center">
            <LifeBuoy className="size-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <h3 className="text-sm font-semibold text-foreground">No tickets match criteria</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {searchQuery || statusFilter
                ? "Try clearing the filters or search keywords to view other support tickets."
                : "No customer inquiries in the database yet. Tickets created by students or agents will appear here."}
            </p>
            <Link
              href="/admin/tickets/new"
              className="mt-4 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-accent text-xs font-semibold text-foreground"
            >
              Create first ticket →
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-accent/40 transition-colors group">
                    <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        {t.ticketNumber}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-foreground">{t.requesterName || "Student"}</div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                        {t.requesterEmail}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-foreground max-w-[260px] truncate">
                      <Link href={`/admin/tickets/${t.id}`} className="hover:text-primary">
                        {t.subject}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="capitalize text-muted-foreground">{t.category}</span>
                    </td>
                    <td className="py-3.5 px-4">
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
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize ${
                          t.status === "new"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold"
                            : t.status === "escalated"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {t.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                      {new Date(t.createdAt).toLocaleDateString("en-IN", {
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

      <div className="text-xs text-muted-foreground flex items-center justify-between">
        <span>Showing {tickets.length} of {total} tickets</span>
        <span>SLA Auto-calculated from priority targets</span>
      </div>
    </div>
  );
}

