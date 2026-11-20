import { ChevronLeft, ChevronRight, LifeBuoy, Plus, Search } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { listSupportTickets, type TicketPriority, type TicketStatus } from "@/lib/admin/tickets";

export const metadata = {
  title: "Tickets & Support · Admin Control Center",
  robots: { index: false },
};

const PAGE_SIZE = 25;
type SP = Record<string, string | undefined>;

const STATUSES: { label: string; value?: TicketStatus }[] = [
  { label: "All" },
  { label: "New", value: "new" },
  { label: "Open", value: "open" },
  { label: "In progress", value: "in_progress" },
  { label: "Waiting for student", value: "waiting_student" },
  { label: "Waiting for engineering", value: "waiting_engineering" },
  { label: "Escalated", value: "escalated" },
  { label: "Reopened", value: "reopened" },
  { label: "Resolved", value: "resolved" },
  { label: "Closed", value: "closed" },
];
const PRIORITIES: TicketPriority[] = ["urgent", "high", "medium", "low"];
const VALID_STATUS = new Set(STATUSES.map((s) => s.value).filter(Boolean) as string[]);

function hrefWith(sp: SP, over: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/tickets?${s}` : "/admin/tickets";
}

const PRIORITY_TONE: Record<string, string> = {
  urgent: "bg-rose-500/10 text-rose-700 dark:text-rose-400",
  high: "bg-amber-500/10 text-amber-800 dark:text-amber-400",
  medium: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  low: "bg-muted text-muted-foreground",
};

export default async function AdminTicketsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  await requireAdminPermission("support.tickets.read");

  const raw = await searchParams;
  const sp: SP = {
    status: raw.status && VALID_STATUS.has(raw.status) ? raw.status : undefined,
    priority: raw.priority && (PRIORITIES as string[]).includes(raw.priority) ? raw.priority : undefined,
    overdue: raw.overdue === "1" ? "1" : undefined,
    q: raw.q?.trim() || undefined,
  };
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);

  const { tickets, total } = await listSupportTickets({
    status: sp.status as TicketStatus | undefined,
    priority: sp.priority as TicketPriority | undefined,
    overdue: sp.overdue === "1",
    query: sp.q,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date().getTime(); // request time, for the overdue marker
  const filtered = Boolean(sp.status || sp.priority || sp.overdue || sp.q);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <LifeBuoy className="size-6 text-primary" />
            <span>Tickets &amp; Support</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Student questions and problems. Open a ticket to reply, assign it or change its status.</p>
        </div>
        <Link href="/admin/tickets/new" className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shadow-2xs hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 shrink-0">
          <Plus className="size-4" /> New ticket
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs space-y-3">
        <nav aria-label="Ticket status" className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] text-xs">
          {STATUSES.map((tab) => {
            const on = (tab.value ?? undefined) === sp.status;
            return (
              <Link
                key={tab.label}
                href={hrefWith({ ...sp, status: undefined }, { status: tab.value })}
                aria-current={on ? "page" : undefined}
                className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors focus-visible:outline-2 ${on ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <form method="GET" action="/admin/tickets" aria-label="Filter tickets" className="flex flex-col sm:flex-row gap-2">
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <label className="relative flex-1">
            <span className="sr-only">Search</span>
            <Search aria-hidden className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <input name="q" defaultValue={sp.q} placeholder="Ticket number, subject, name or email" className="w-full min-h-9 bg-background border border-border text-xs rounded-lg pl-8 pr-3 py-1.5" />
          </label>
          <label>
            <span className="sr-only">Priority</span>
            <select name="priority" defaultValue={sp.priority ?? ""} className="min-h-9 w-full bg-background border border-border text-xs rounded-lg px-2 py-1.5">
              <option value="">Any priority</option>
              {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
            <input type="checkbox" name="overdue" value="1" defaultChecked={sp.overdue === "1"} /> Overdue only
          </label>
          <button type="submit" className="min-h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">Apply</button>
          {filtered && <Link href="/admin/tickets" className="self-center text-xs font-semibold text-muted-foreground hover:text-foreground px-1">Clear</Link>}
        </form>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="ticket-count" aria-live="polite">
        {total === 0 ? "No tickets match." : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString("en-IN")} tickets`}
      </p>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {tickets.length === 0 ? (
          <div className="py-16 text-center">
            <LifeBuoy aria-hidden className="size-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <h2 className="text-sm font-semibold text-foreground">{filtered ? "No tickets match these filters" : "No tickets yet"}</h2>
            <p className="text-xs text-muted-foreground mt-1">{filtered ? "Change or clear the filters." : "Tickets created by students or staff appear here."}</p>
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Support tickets, newest first</caption>
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-3 px-4">Ticket</th>
                  <th scope="col" className="py-3 px-4">From</th>
                  <th scope="col" className="py-3 px-4">Subject</th>
                  <th scope="col" className="py-3 px-4">Priority</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4">Resolve by</th>
                  <th scope="col" className="py-3 px-4 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {tickets.map((t) => {
                  const open = t.status !== "resolved" && t.status !== "closed";
                  const overdue = open && t.resolutionDueAt && new Date(t.resolutionDueAt).getTime() < now;
                  return (
                    <tr key={t.id} className="hover:bg-accent/40">
                      <td className="py-3 px-4 font-mono font-bold"><Link href={`/admin/tickets/${t.id}`} className="text-primary hover:underline">{t.ticketNumber}</Link></td>
                      <td className="py-3 px-4"><div className="font-medium text-foreground">{t.requesterName || "—"}</div><div className="text-[11px] text-muted-foreground truncate max-w-[180px]">{t.requesterEmail}</div></td>
                      <td className="py-3 px-4 font-medium text-foreground max-w-[260px] truncate"><Link href={`/admin/tickets/${t.id}`} className="hover:text-primary">{t.subject}</Link></td>
                      <td className="py-3 px-4"><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PRIORITY_TONE[t.priority] ?? ""}`}>{t.priority}</span></td>
                      <td className="py-3 px-4"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize bg-muted text-foreground">{t.status.replaceAll("_", " ")}</span></td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {!open ? <span className="text-muted-foreground">—</span> : t.resolutionDueAt ? (
                          <span className={overdue ? "font-semibold text-rose-700 dark:text-rose-400" : "text-muted-foreground"}>
                            {overdue ? "Overdue · " : ""}{new Date(t.resolutionDueAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        ) : <span className="text-muted-foreground">No target</span>}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground font-mono whitespace-nowrap">{new Date(t.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-xs">
          {page > 1 ? <Link href={hrefWith(sp, { page: String(page - 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent"><ChevronLeft aria-hidden className="size-3.5" /> Previous</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={hrefWith(sp, { page: String(page + 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent">Next <ChevronRight aria-hidden className="size-3.5" /></Link> : <span />}
        </nav>
      )}
    </div>
  );
}
