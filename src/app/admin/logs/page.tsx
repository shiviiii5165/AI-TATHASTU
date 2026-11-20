import { ChevronLeft, ChevronRight, FileText } from "lucide-react";
import Link from "next/link";

import { requireAdmin } from "@/lib/admin";
import { listAdminAudits, listAuditResources } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { displayIp, fullTimestamp } from "@/lib/admin/summaries";

export const metadata = {
  title: "Security Audit Logs · Admin Control Center",
  robots: { index: false },
};

const PAGE_SIZE = 50;
type SP = Record<string, string | undefined>;
const one = (v: string | undefined) => v?.trim() || undefined;

function hrefWith(sp: SP, over: SP) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...over })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/admin/logs?${s}` : "/admin/logs";
}

/** Details as readable "key: value" pairs instead of raw JSON. */
function detailText(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ");
}

export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<SP> }) {
  await requireAdmin();
  await requireAdminPermission("audit.read");

  const raw = await searchParams;
  const sp: SP = { resource: one(raw.resource), actor: one(raw.actor), action: one(raw.action), from: one(raw.from), to: one(raw.to) };
  const page = Math.max(1, Number.parseInt(raw.page ?? "1", 10) || 1);

  const [{ logs, total }, resources] = await Promise.all([
    listAdminAudits({ resource: sp.resource, actorEmail: sp.actor, action: sp.action, from: sp.from, to: sp.to, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    listAuditResources(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(sp).some(Boolean);
  const field = "w-full min-h-9 bg-background border border-border text-xs rounded-lg px-2.5 py-1.5 focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <FileText className="size-6 text-primary" />
          <span>Security Audit Logs</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          A permanent record of what administrators changed: who did it, what they changed and when. Entries can&apos;t be edited or deleted here.
        </p>
      </div>

      <form method="GET" action="/admin/logs" aria-label="Filter audit logs" className="rounded-2xl border border-border bg-card p-3.5 shadow-2xs grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5 items-end">
        <label className="lg:col-span-2 text-[11px] text-muted-foreground">Administrator email
          <input name="actor" defaultValue={sp.actor} placeholder="Contains…" className={`${field} mt-1`} />
        </label>
        <label className="text-[11px] text-muted-foreground">Action
          <input name="action" defaultValue={sp.action} placeholder="e.g. ticket" className={`${field} mt-1`} />
        </label>
        <label className="text-[11px] text-muted-foreground">Area
          <select name="resource" defaultValue={sp.resource ?? ""} className={`${field} mt-1`}>
            <option value="">All areas</option>
            {resources.map((r) => <option key={r} value={r}>{r.replaceAll("_", " ")}</option>)}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground">From
          <input type="date" name="from" defaultValue={sp.from} className={`${field} mt-1`} />
        </label>
        <label className="text-[11px] text-muted-foreground">To
          <input type="date" name="to" defaultValue={sp.to} className={`${field} mt-1`} />
        </label>
        <div className="sm:col-span-2 lg:col-span-6 flex justify-end gap-2">
          {filtered && <Link href="/admin/logs" className="text-xs font-semibold text-muted-foreground hover:text-foreground px-2 py-2">Clear filters</Link>}
          <button type="submit" className="min-h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2">Apply</button>
        </div>
      </form>

      <p className="text-xs text-muted-foreground" data-testid="audit-count" aria-live="polite">
        {total === 0 ? "No entries match." : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total.toLocaleString("en-IN")} entries`}
      </p>

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-xs text-muted-foreground">{filtered ? "No entries match these filters." : "No administrative actions recorded yet."}</div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Audit log entries, newest first</caption>
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-3 px-4">When</th>
                  <th scope="col" className="py-3 px-4">Administrator</th>
                  <th scope="col" className="py-3 px-4">Action</th>
                  <th scope="col" className="py-3 px-4">Area · record</th>
                  <th scope="col" className="py-3 px-4">Details</th>
                  <th scope="col" className="py-3 px-4">IP address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((log) => (
                  <tr key={log.id} className="align-top hover:bg-accent/40">
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{fullTimestamp(log.createdAt)}</td>
                    <td className="py-3 px-4 font-semibold text-foreground">{log.actorEmail}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-muted text-foreground font-mono text-[11px]">{log.action}</span></td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {log.resource.replaceAll("_", " ")}
                      {log.targetId && <span className="block font-mono text-[10px]">#{log.targetId.slice(0, 8)}</span>}
                    </td>
                    <td className="py-3 px-4 text-[11px] text-muted-foreground max-w-[320px] break-words">{detailText(log.details) || "—"}</td>
                    <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">{displayIp(log.ipAddress)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        IP address is recorded only when the hosting platform supplies a trusted one; otherwise it shows as Unknown rather than a guess.
      </p>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-xs">
          {page > 1 ? <Link href={hrefWith(sp, { page: String(page - 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent"><ChevronLeft aria-hidden className="size-3.5" /> Newer</Link> : <span />}
          <span className="text-muted-foreground">Page {page} of {pages}</span>
          {page < pages ? <Link href={hrefWith(sp, { page: String(page + 1) })} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border hover:bg-accent">Older <ChevronRight aria-hidden className="size-3.5" /></Link> : <span />}
        </nav>
      )}
    </div>
  );
}
