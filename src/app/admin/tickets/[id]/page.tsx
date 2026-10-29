import { ArrowLeft, Clock, LifeBuoy, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { TicketConversation } from "@/components/admin/ticket-conversation";
import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { getTicketDetails } from "@/lib/admin/tickets";

export const metadata = {
  title: "Ticket Details · Admin Control Center",
  robots: { index: false },
};

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminTicketDetailPage({ params }: TicketDetailPageProps) {
  const admin = await requireAdmin();
  await requireAdminPermission("support.tickets.read");

  const { id } = await params;
  const ticket = await getTicketDetails(id, { includeInternalNotes: true });

  if (!ticket) {
    notFound();
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

      {/* Interactive Conversation & Notes */}
      <TicketConversation ticket={ticket} adminEmail={admin.email || "admin@aitathastu.com"} />
    </div>
  );
}

