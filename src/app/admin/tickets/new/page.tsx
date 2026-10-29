import { ArrowLeft, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { createTicketAction } from "../actions";

export const metadata = {
  title: "New Support Ticket · Admin Control Center",
  robots: { index: false },
};

export default async function AdminNewTicketPage() {
  await requireAdmin();
  await requireAdminPermission("support.tickets.create");

  async function handleCreate(formData: FormData) {
    "use server";
    const res = await createTicketAction(formData);
    if (res.ok && res.ticketId) {
      redirect(`/admin/tickets/${res.ticketId}`);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/tickets"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to ticket queue</span>
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <LifeBuoy className="size-6 text-primary" />
          <span>Create New Support Ticket</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Log an incoming phone call, chat request, or student inquiry into the ticket state machine.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-2xs">
        <form action={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">
                Requester Email <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                name="requesterEmail"
                required
                placeholder="student@university.edu"
                className="w-full bg-muted/50 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary focus:bg-background"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Requester Name</label>
              <input
                type="text"
                name="requesterName"
                placeholder="Full student or faculty name"
                className="w-full bg-muted/50 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary focus:bg-background"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Category</label>
              <select
                name="category"
                defaultValue="general"
                className="w-full bg-muted/50 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary focus:bg-background"
              >
                <option value="general">General Inquiry</option>
                <option value="login">Account & Login</option>
                <option value="github">GitHub Integration</option>
                <option value="linkedin">LinkedIn Sync</option>
                <option value="resume">Resume Parsing</option>
                <option value="ai">AI Model Failure</option>
                <option value="privacy">Privacy & Deletion</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Priority</label>
              <select
                name="priority"
                defaultValue="medium"
                className="w-full bg-muted/50 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary focus:bg-background"
              >
                <option value="low">Low (48h SLA)</option>
                <option value="medium">Medium (24h SLA)</option>
                <option value="high">High (8h SLA)</option>
                <option value="urgent">Urgent (2h SLA)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1.5">Source Channel</label>
              <select
                name="sourceChannel"
                defaultValue="manual"
                className="w-full bg-muted/50 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary focus:bg-background"
              >
                <option value="manual">Manual Admin Entry</option>
                <option value="phone">Phone / Callback</option>
                <option value="chat">Live Chat</option>
                <option value="email">Direct Support Email</option>
                <option value="web">Website Form</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Subject <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              name="subject"
              required
              placeholder="e.g. Cannot connect GitHub repository for skill verification"
              className="w-full bg-muted/50 border border-border text-xs rounded-lg px-3 py-2 outline-none focus:border-primary focus:bg-background"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Initial Message / Issue Description <span className="text-rose-500">*</span>
            </label>
            <textarea
              name="initialMessage"
              required
              rows={5}
              placeholder="Detailed description of the issue or requester's message..."
              className="w-full bg-muted/50 border border-border text-xs rounded-lg p-3 outline-none focus:border-primary focus:bg-background leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2.5">
            <Link
              href="/admin/tickets"
              className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors shadow-2xs"
            >
              Create Ticket & Send Acknowledgement
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
