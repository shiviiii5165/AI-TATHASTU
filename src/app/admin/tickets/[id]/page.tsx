import { ArrowLeft, Clock, LifeBuoy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { assignTicketAction } from "@/app/admin/tickets/actions";
import { TicketConversation } from "@/components/admin/ticket-conversation";
import { requireAdmin } from "@/lib/admin";
import { hasPermission, requireAdminPermission } from "@/lib/admin/rbac";
import { getTicketDetails, listAssignableAdmins } from "@/lib/admin/tickets";

export const metadata = {
  title: "Ticket Details · Admin Control Center",
  robots: { index: false },
};

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTicketDetailPage({ params, searchParams }: TicketDetailPageProps & { searchParams?: Promise<{ assign?: string }> }) {
  const admin = await requireAdmin();
  const ctx = await requireAdminPermission("support.tickets.read");
  const canAssign = hasPermission(ctx, "support.tickets.assign");

  const { id } = await params;
  const assignResult = (await searchParams)?.assign;
  const [ticket, assignees] = await Promise.all([
    getTicketDetails(id, { includeInternalNotes: true }),
    canAssign ? listAssignableAdmins() : Promise.resolve([]),
  ]);

  if (!ticket) {
    notFound();
  }

  // A plain form: the result is reported back in the URL, so there is no optimistic "saved" message.
  async function assign(formData: FormData) {
    "use server";
    const to = String(formData.get("assignee") || "");
    const res = await assignTicketAction(id, to || null);
    redirect(`/admin/tickets/${id}?assign=${res.ok ? "saved" : "error"}`);
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Back Link & Header */}
      <div>
        <Link
          href="/admin/tickets"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to ticket queue</span>
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="font-bold text-foreground text-sm">{ticket.ticketNumber}</span>
              <span className="text-muted-foreground">·</span>
              <span className="capitalize text-muted-foreground">{ticket.category}</span>
            </div>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-foreground">
              {ticket.subject}
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Requested by <strong className="text-foreground">{ticket.requesterName || "Student"}</strong> ({ticket.requesterEmail})
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                ticket.priority === "urgent"
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  : ticket.priority === "high"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
              }`}
            >
              {ticket.priority} priority
            </span>

            <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-muted text-muted-foreground">
              {ticket.status.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* SLA Info Banner */}
      {ticket.firstResponseDueAt && !ticket.firstResponseAt && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="size-4 shrink-0 text-amber-600" />
            <span>
              <strong>First Response SLA Deadline:</strong>{" "}
              {new Date(ticket.firstResponseDueAt).toLocaleString("en-IN", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <span className="font-mono text-[11px] font-semibold">Active Timer</span>
        </div>
      )}

      {/* Assignment */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-testid="assignment">
        <p className="text-xs text-muted-foreground">
          Assigned to <strong className="text-foreground">{ticket.assignedToId ? ticket.assignedToName || "an admin" : "nobody"}</strong>
          {assignResult === "saved" && <span role="status" className="ml-2 text-emerald-700 dark:text-emerald-400 font-semibold">Saved.</span>}
          {assignResult === "error" && <span role="alert" className="ml-2 text-rose-700 dark:text-rose-400 font-semibold">Couldn&apos;t change the assignment.</span>}
        </p>
        {canAssign && (
          <form action={assign} className="flex items-center gap-2">
            <label className="sr-only" htmlFor="assignee">Assign to</label>
            <select id="assignee" name="assignee" defaultValue={ticket.assignedToId ?? ""} className="min-h-9 bg-background border border-border text-xs rounded-lg px-2 py-1.5">
              <option value="">Unassigned</option>
              {assignees.map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
            </select>
            <button type="submit" className="min-h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">Assign</button>
          </form>
        )}
      </div>

      {/* Interactive Conversation & Notes */}
      <TicketConversation ticket={ticket} adminEmail={admin.email || "admin@aitathastu.com"} />
    </div>
  );
}

