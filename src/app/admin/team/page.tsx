import { CheckCircle2, ShieldCheck, UserCheck, Users } from "lucide-react";
import Link from "next/link";

import { db } from "@/db";
import { ADMIN_ROLES, adminTeamMembers, users } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { getAdminContext, requireAdminPermission } from "@/lib/admin/rbac";
import { eq } from "drizzle-orm";

export const metadata = {
  title: "Admin Team & Roles · Admin Control Center",
  robots: { index: false },
};

export default async function AdminTeamPage() {
  const currentAdmin = await requireAdmin();
  await requireAdminPermission("team.read");

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
    .innerJoin(users, eq(users.id, adminTeamMembers.userId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="size-6 text-primary" />
            <span>Admin Team & Role-Based Access Control</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
            Assign fine-grained operational roles and permissions to support staff, AI engineers, and content editors.
          </p>
        </div>
      </div>

      {/* Roles Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {ADMIN_ROLES.map((r) => (
          <div key={r} className="p-4 rounded-xl border border-border bg-card shadow-2xs">
            <span className="font-mono text-[10px] uppercase font-bold text-primary block">Role</span>
            <div className="font-bold text-xs capitalize text-foreground mt-0.5">{r.replace("_", " ")}</div>
          </div>
        ))}
      </div>

      {/* Team Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-border bg-muted/20">
          <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
            Active Staff Members ({members.length})
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="py-12 text-center text-xs text-muted-foreground">
            No dedicated team members assigned. Global administrators listed in ADMIN_EMAILS automatically retain super_admin privileges.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Operational Role</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-accent/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-foreground">{m.userName || "Admin Member"}</div>
                      <div className="text-[11px] text-muted-foreground">{m.userEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold capitalize text-primary">
                      {m.role.replace("_", " ")}
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground">{m.department || "General Operations"}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-muted-foreground font-mono">
                      {new Date(m.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
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
