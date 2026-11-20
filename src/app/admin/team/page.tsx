import { ShieldCheck } from "lucide-react";
import { eq } from "drizzle-orm";

import { ConfirmSubmit } from "@/components/admin/confirm-submit";
import { db } from "@/db";
import { ADMIN_ROLES, adminTeamMembers, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { hasPermission, requireAdminPermission, ROLE_PERMISSIONS } from "@/lib/admin/rbac";
import { teamSummary } from "@/lib/admin/summaries";

import { addTeamMemberAction, updateTeamMemberAction } from "./actions";

export const metadata = {
  title: "Admin Team & Roles · Admin Control Center",
  robots: { index: false },
};

const ROLE_HELP: Record<string, string> = {
  super_admin: "Everything, including Student Intelligence.",
  support_admin: "Tickets, support rules, student accounts, help articles, institutions.",
  support_agent: "Answer tickets and read student accounts.",
  ai_ops: "AI providers, budgets and system health.",
  finance_admin: "AI costs, budgets and audit logs.",
  content_editor: "Website, help articles, newsletter and email templates.",
  security_auditor: "Audit logs, student accounts and the team list (read only).",
};
const label = (r: string) => r.replaceAll("_", " ");

export default async function AdminTeamPage({ searchParams }: { searchParams?: Promise<{ result?: string }> } = {}) {
  const currentAdmin = await requireAdmin();
  const ctx = await requireAdminPermission("team.read");
  const canManage = hasPermission(ctx, "team.manage");
  const result = (await searchParams)?.result;
  const [kind, ...msg] = (result ?? "").split(":");

  const members = await db
    .select({
      id: adminTeamMembers.id,
      userId: adminTeamMembers.userId,
      role: adminTeamMembers.role,
      department: adminTeamMembers.department,
      isActive: adminTeamMembers.isActive,
      createdAt: adminTeamMembers.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(adminTeamMembers)
    .innerJoin(users, eq(users.id, adminTeamMembers.userId))
    .orderBy(adminTeamMembers.createdAt);
  const counts = teamSummary(members);
  const field = "min-h-9 bg-background border border-border text-xs rounded-lg px-2.5 py-1.5";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <ShieldCheck className="size-6 text-primary" />
          <span>Admin Team &amp; Role-Based Access Control</span>
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
          Who can use the admin and what each role can do. Accounts listed in the ADMIN_EMAILS setting are always full administrators and don&apos;t appear here.
        </p>
      </div>

      {result && (
        <p role={kind === "error" ? "alert" : "status"} className={`rounded-xl border px-4 py-2.5 text-xs ${kind === "error" ? "border-rose-500/30 bg-rose-500/5 text-rose-800 dark:text-rose-300" : "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"}`}>
          {msg.join(":")}
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {ADMIN_ROLES.map((r) => (
          <div key={r} className="p-4 rounded-xl border border-border bg-card shadow-2xs">
            <div className="flex items-baseline justify-between gap-2">
              <div className="font-bold text-xs capitalize text-foreground">{label(r)}</div>
              <span className="text-[10px] text-muted-foreground">{members.filter((m) => m.role === r && m.isActive).length} active</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{ROLE_HELP[r]}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{ROLE_PERMISSIONS[r].length} permissions</p>
          </div>
        ))}
      </div>

      {canManage && (
        <form action={addTeamMemberAction} aria-label="Add a team member" className="rounded-2xl border border-border bg-card p-4 shadow-2xs grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
          <label className="sm:col-span-2 text-[11px] text-muted-foreground">Email of an existing account
            <input name="email" type="email" required placeholder="name@example.com" className={`${field} w-full mt-1`} />
          </label>
          <label className="text-[11px] text-muted-foreground">Role
            <select name="role" required defaultValue="support_agent" className={`${field} w-full mt-1 capitalize`}>
              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-muted-foreground">Team (optional)
            <input name="department" placeholder="e.g. Support" className={`${field} w-full mt-1`} />
          </label>
          <div className="sm:col-span-4 flex justify-end">
            <ConfirmSubmit message="Give this account admin access with the selected role?" className="min-h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90">
              Add member
            </ConfirmSubmit>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider" data-testid="team-counts">
            Staff Members ({counts.total}) · {counts.active} active · {counts.inactive} inactive
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No team members yet. Accounts in ADMIN_EMAILS are full administrators automatically.
          </div>
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-xs">
              <caption className="sr-only">Admin team members</caption>
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th scope="col" className="py-3 px-4">Member</th>
                  <th scope="col" className="py-3 px-4">Role</th>
                  <th scope="col" className="py-3 px-4">Team</th>
                  <th scope="col" className="py-3 px-4">Status</th>
                  <th scope="col" className="py-3 px-4 text-right">Added</th>
                  {canManage && <th scope="col" className="py-3 px-4"><span className="sr-only">Actions</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((m) => {
                  const self = m.userId === currentAdmin.id;
                  return (
                    <tr key={m.id} className="hover:bg-accent/40">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-foreground">{m.userName || "—"}{self && <span className="ml-1.5 text-[10px] text-muted-foreground">(you)</span>}</div>
                        <div className="text-[11px] text-muted-foreground">{m.userEmail}</div>
                      </td>
                      <td className="py-3 px-4">
                        {canManage && !self ? (
                          <form action={updateTeamMemberAction} className="flex items-center gap-1.5">
                            <input type="hidden" name="memberId" value={m.id} />
                            <input type="hidden" name="op" value="role" />
                            <label className="sr-only" htmlFor={`role-${m.id}`}>Role for {m.userEmail}</label>
                            <select id={`role-${m.id}`} name="role" defaultValue={m.role} className={`${field} capitalize`}>
                              {ADMIN_ROLES.map((r) => <option key={r} value={r}>{label(r)}</option>)}
                            </select>
                            <ConfirmSubmit message={`Change ${m.userEmail}'s role?`} className="text-[11px] font-semibold text-primary hover:underline">Save</ConfirmSubmit>
                          </form>
                        ) : (
                          <span className="font-semibold capitalize text-foreground">{label(m.role)}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{m.department || "—"}</td>
                      <td className="py-3 px-4">
                        {m.isActive ? (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">Active</span>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground">Inactive</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground font-mono whitespace-nowrap">
                        {new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4 text-right">
                          {!self && (
                            <form action={updateTeamMemberAction}>
                              <input type="hidden" name="memberId" value={m.id} />
                              <input type="hidden" name="op" value={m.isActive ? "deactivate" : "activate"} />
                              <ConfirmSubmit
                                message={m.isActive ? `Remove ${m.userEmail}'s admin access? They keep their student account.` : `Give ${m.userEmail} admin access again with their current role?`}
                                className={`text-[11px] font-semibold hover:underline ${m.isActive ? "text-rose-700 dark:text-rose-400" : "text-primary"}`}
                              >
                                {m.isActive ? "Deactivate" : "Reactivate"}
                              </ConfirmSubmit>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
