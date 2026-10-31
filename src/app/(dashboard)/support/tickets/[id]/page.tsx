import { ArrowLeft, Clock, LifeBuoy, Send } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { getCurrentUser } from "@/lib/dal";
import { addTicketMessage, getTicketDetails } from "@/lib/admin/tickets";

export const metadata = {
  title: "Support Ticket Tracking · AI Tathastu",
};

export const instant = false;

const MAX_REPLY_CHARS = 5000;

// IDOR protection: only the requester (or an admin) can see or answer a ticket.
function canAccessTicket(
  user: { id: string; email: string | null; isAdmin: boolean },
  ticket: { requesterId: string | null; requesterEmail: string },
) {
  const isOwner =
    (user.email && ticket.requesterEmail.toLowerCase() === user.email.toLowerCase()) ||
    ticket.requesterId === user.id;
  return Boolean(isOwner) || user.isAdmin;
}

interface StudentTicketPageProps {
  params: Promise<{ id: string }>;
}

export default async function StudentTicketTrackingPage({ params }: StudentTicketPageProps) {
  await connection();
  const user = await getCurrentUser();
  const { id } = await params;

  // Strict internal note omission for student security
  const ticket = await getTicketDetails(id, { includeInternalNotes: false });

  if (!ticket) {
    notFound();
  }

  if (!canAccessTicket(user, ticket)) notFound();

  async function handleStudentReply(formData: FormData) {
    "use server";
    const content = String(formData.get("content") || "").trim();
    if (!content || content.length > MAX_REPLY_CHARS) return;

    // Authorize the call itself, not the render that produced this form.
    const author = await getCurrentUser();
    const current = await getTicketDetails(id, { includeInternalNotes: false });
    if (!current || current.status === "closed" || !canAccessTicket(author, current)) notFound();

    await addTicketMessage({
      ticketId: id,
      authorId: author.id,
      authorName: author.name || "Student",
      authorEmail: author.email || undefined,
      isInternalNote: false, // Student messages are always public
      content,
    });

    redirect(`/support/tickets/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to dashboard</span>
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs text-muted-foreground">
              Support Ticket <strong className="text-foreground">{ticket.ticketNumber}</strong>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {ticket.subject}
            </h1>
          </div>

          <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold capitalize bg-primary/10 text-primary">
            {ticket.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Messages Thread (Only public messages, zero internal notes) */}
      <div className="space-y-4">
        {ticket.messages.map((m) => {
          const isStudent = m.authorEmail?.toLowerCase() === user.email?.toLowerCase();
          return (
            <div
              key={m.id}
              className={`p-4 rounded-2xl border text-xs sm:text-sm leading-relaxed ${
                isStudent
                  ? "bg-accent/40 border-border text-foreground ml-6"
                  : "bg-card border-border text-foreground mr-6 shadow-2xs"
              }`}
            >
              <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {isStudent ? "You" : m.authorName || "AI Tathastu Support"}
                </span>
                <span className="font-mono text-[11px]">
                  {new Date(m.createdAt).toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          );
        })}
      </div>

      {/* Student Reply Form */}
      {ticket.status !== "closed" && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-2xs">
          <h2 className="text-xs font-bold text-foreground mb-2">Reply to Support Team</h2>
          <form action={handleStudentReply} className="space-y-3">
            <textarea
              name="content"
              rows={3}
              required
              placeholder="Type your reply here..."
              className="w-full bg-muted/40 border border-border text-xs rounded-xl p-3 outline-none focus:border-primary focus:bg-background leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 flex items-center gap-1.5 shadow-2xs transition-colors"
              >
                <Send className="size-3.5" />
                <span>Send Reply</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
