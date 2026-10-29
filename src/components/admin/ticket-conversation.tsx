"use client";

import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Lock,
  MessageSquare,
  Send,
  ShieldAlert,
  User,
  UserCheck,
} from "lucide-react";
import { useState, useTransition } from "react";

import type { SupportMessage, TicketPriority, TicketStatus } from "@/db/schema";
import {
  assignTicketAction,
  changeTicketStatusAction,
  postTicketMessageAction,
} from "@/app/admin/tickets/actions";

interface TicketConversationProps {
  ticket: {
    id: string;
    ticketNumber: string;
    requesterEmail: string;
    requesterName: string | null;
    subject: string;
    category: string;
    priority: TicketPriority;
    status: TicketStatus;
    assignedToId: string | null;
    assignedToName?: string | null;
    firstResponseDueAt: Date | null;
    resolutionDueAt: Date | null;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    resolutionNotes: string | null;
    createdAt: Date;
    messages: SupportMessage[];
  };
  adminEmail: string;
}

export function TicketConversation({ ticket, adminEmail }: TicketConversationProps) {
  const [activeTab, setActiveTab] = useState<"reply" | "note">("reply");
  const [content, setContent] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setErrorMsg(null);

    startTransition(async () => {
      const res = await postTicketMessageAction(
        ticket.id,
        content,
        activeTab === "note"
      );
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to post message");
      } else {
        setContent("");
      }
    });
  };

  const handleStatusChange = (newStatus: TicketStatus) => {
    setErrorMsg(null);
    startTransition(async () => {
      const res = await changeTicketStatusAction(
        ticket.id,
        newStatus,
        newStatus === "resolved" ? resolutionNotes || undefined : undefined
      );
      if (!res.ok) {
        setErrorMsg(res.error || "Failed to update status");
      }
    });
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Top Action Bar: Status State Machine Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-border bg-card shadow-2xs">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold text-muted-foreground">Workflow Transition:</span>
          {ticket.status !== "in_progress" && ticket.status !== "resolved" && ticket.status !== "closed" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("in_progress")}
              className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 font-semibold transition-colors disabled:opacity-50"
            >
              Start Progress
            </button>
          )}

          {ticket.status !== "waiting_student" && ticket.status !== "resolved" && ticket.status !== "closed" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("waiting_student")}
              className="px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 font-semibold transition-colors disabled:opacity-50"
            >
              Wait for Student
            </button>
          )}

          {ticket.status !== "escalated" && ticket.status !== "resolved" && ticket.status !== "closed" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("escalated")}
              className="px-2.5 py-1 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 font-semibold transition-colors disabled:opacity-50"
            >
              Escalate
            </button>
          )}

          {ticket.status !== "resolved" && ticket.status !== "closed" && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("resolved")}
              className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-semibold transition-colors disabled:opacity-50"
            >
              Resolve Ticket
            </button>
          )}

          {(ticket.status === "resolved" || ticket.status === "closed") && (
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleStatusChange("reopened")}
              className="px-2.5 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 font-semibold transition-colors disabled:opacity-50"
            >
              Reopen Ticket
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>Assigned:</span>
          <span className="font-semibold text-foreground">
            {ticket.assignedToName || "Unassigned"}
          </span>
        </div>
      </div>

      {/* Conversation Thread */}
      <div className="space-y-4">
        {ticket.messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-2xl p-5 border text-xs sm:text-sm leading-relaxed ${
              m.isInternalNote
                ? "bg-amber-500/8 border-amber-500/30 text-amber-950 dark:text-amber-100"
                : "bg-card border-border text-foreground shadow-2xs"
            }`}
          >
            <div className="flex items-center justify-between mb-3 text-xs">
              <div className="flex items-center gap-2">
                {m.isInternalNote ? (
                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide">
                    <Lock className="size-3" />
                    Internal Note (Staff Only)
                  </span>
                ) : (
                  <span className="font-bold text-foreground">
                    {m.authorName || m.authorEmail || "Requester"}
                  </span>
                )}
                <span className="text-muted-foreground text-[11px]">
                  {m.authorEmail}
                </span>
              </div>
              <span className="text-muted-foreground font-mono text-[11px]">
                {new Date(m.createdAt).toLocaleString("en-IN", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="whitespace-pre-wrap font-sans">{m.content}</div>
          </div>
        ))}
      </div>

      {/* Response Box */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        {/* Toggle between Public Reply & Internal Note */}
        <div className="flex items-center gap-2 border-b border-border pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("reply")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "reply"
                ? "bg-primary text-primary-foreground shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Send className="size-3.5" />
            <span>Public Reply to Student</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("note")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              activeTab === "note"
                ? "bg-amber-500 text-white shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Lock className="size-3.5" />
            <span>Private Internal Note</span>
          </button>
        </div>

        <form onSubmit={handlePost} className="space-y-3">
          <textarea
            rows={4}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              activeTab === "reply"
                ? "Draft a response to the student. This message will be emailed and visible in their tracking portal..."
                : "Write a private note for other support agents or engineering. Never visible to students..."
            }
            className={`w-full text-xs rounded-xl p-3 outline-none border transition-colors leading-relaxed ${
              activeTab === "note"
                ? "bg-amber-500/5 border-amber-500/30 focus:border-amber-500 text-foreground"
                : "bg-muted/40 border-border focus:border-primary focus:bg-background text-foreground"
            }`}
          />

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-muted-foreground">
              {activeTab === "reply"
                ? "Will be dispatched via transactional support email."
                : "Strictly hidden from student tracking views."}
            </span>

            <button
              type="submit"
              disabled={isPending || !content.trim()}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-50 ${
                activeTab === "note"
                  ? "bg-amber-600 text-white hover:bg-amber-700"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {isPending ? "Posting..." : activeTab === "note" ? "Add Internal Note" : "Send Public Reply"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

