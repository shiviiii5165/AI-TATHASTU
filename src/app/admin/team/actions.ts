"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { ADMIN_ROLES, type AdminRole, adminTeamMembers, users } from "@/db/schema";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";

/**
 * Admin team management. Every action needs team.manage, validates its input, never changes the acting admin's own
 * access, and is written to the audit log. Results are reported in the URL (no optimistic messages).
 * Accounts in ADMIN_EMAILS stay super admins whatever is stored here (lib/admin/rbac.ts).
 */

const done = (msg: string): never => redirect(`/admin/team?result=${encodeURIComponent(msg)}`);
const isRole = (r: string): r is AdminRole => (ADMIN_ROLES as readonly string[]).includes(r);
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

export async function addTeamMemberAction(formData: FormData) {
  const ctx = await requireAdminPermission("team.manage");
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const role = String(formData.get("role") || "");
  const department = String(formData.get("department") || "").trim().slice(0, 80) || null;
  if (!email || !isRole(role)) done("error:Enter an email and choose a role.");

  const [user] = await db.select({ id: users.id }).from(users).where(and(sql`lower(${users.email}) = ${email}`, isNull(users.deletedAt)));
  if (!user) done("error:No account uses that email. The person must sign up first.");
  if (user!.id === ctx.user.id) done("error:You can't change your own access.");

  const [existing] = await db.select({ id: adminTeamMembers.id }).from(adminTeamMembers).where(eq(adminTeamMembers.userId, user!.id));
  if (existing) done("error:That account is already on the team. Change its role below.");

  await db.insert(adminTeamMembers).values({ userId: user!.id, role: role as AdminRole, department, isActive: true });
  await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: "team.member_add", resource: "admin_team_members", targetId: user!.id, details: { role, department } });
  revalidatePath("/admin/team");
  done("ok:Member added.");
}

export async function updateTeamMemberAction(formData: FormData) {
  const ctx = await requireAdminPermission("team.manage");
  const memberId = String(formData.get("memberId") || "");
  const op = String(formData.get("op") || "");
  if (!isUuid(memberId)) done("error:Unknown member.");

  const [member] = await db.select().from(adminTeamMembers).where(eq(adminTeamMembers.id, memberId));
  if (!member) done("error:Unknown member.");
  if (member!.userId === ctx.user.id) done("error:You can't change your own access.");

  if (op === "role") {
    const role = String(formData.get("role") || "");
    if (!isRole(role)) done("error:Choose a valid role.");
    if (role === member!.role) done("ok:No change.");
    await db.update(adminTeamMembers).set({ role: role as AdminRole, updatedAt: new Date() }).where(eq(adminTeamMembers.id, memberId));
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: "team.role_change", resource: "admin_team_members", targetId: member!.userId, details: { previous: member!.role, next: role } });
  } else if (op === "deactivate" || op === "activate") {
    const isActive = op === "activate";
    await db.update(adminTeamMembers).set({ isActive, updatedAt: new Date() }).where(eq(adminTeamMembers.id, memberId));
    await recordAdminAudit({ actorId: ctx.user.id, actorEmail: ctx.user.email || "admin", action: isActive ? "team.member_activate" : "team.member_deactivate", resource: "admin_team_members", targetId: member!.userId });
  } else {
    done("error:Unknown action.");
  }
  revalidatePath("/admin/team");
  done(op === "role" ? "ok:Role changed." : op === "activate" ? "ok:Member reactivated." : "ok:Member deactivated. Their admin access ends on their next request.");
}
