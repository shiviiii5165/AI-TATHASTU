import "server-only";

import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { db } from "@/db";
import { ADMIN_ROLES, type AdminRole, adminTeamMembers, type User } from "@/db/schema";
import { isAdminSessionFresh, requireAdminMfa } from "@/lib/admin/mfa";
import { isAdminEmail } from "@/lib/admin-emails";
import { getCurrentUser } from "@/lib/dal";

export { ADMIN_ROLES, type AdminRole };

export const ALL_ADMIN_PERMISSIONS = [
  // Support & Tickets
  "support.tickets.read",
  "support.tickets.create",
  "support.tickets.reply",
  "support.tickets.note",
  "support.tickets.assign",
  "support.tickets.escalate",
  "support.tickets.close",
  "support.rules.manage",

  // Student Account Management
  "students.read",
  "students.restrict",
  "students.sessions.revoke",
  "students.delete.request",
  "students.delete.approve",

  // Team & RBAC
  "team.read",
  "team.manage",

  // Email Template Studio & Delivery
  "email.templates.read",
  "email.templates.edit",
  "email.templates.publish",
  "email.send.test",
  "email.delivery.retry",

  // AI & Model Operations
  "ai.providers.read",
  "ai.providers.manage",
  "ai.budgets.manage",

  // Logs & Security Audit
  "logs.read",
  "audit.read",

  // CMS, KB & Newsletter
  "cms.edit",
  "cms.publish",
  "kb.manage",
  "newsletter.manage",

  // Academic catalogue
  "institutions.manage",

  // System & Platform
  "flags.manage",
  "system.manage",
] as const;

export type AdminPermission = (typeof ALL_ADMIN_PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<AdminRole, readonly AdminPermission[]> = {
  super_admin: ALL_ADMIN_PERMISSIONS,

  support_admin: [
    "support.tickets.read",
    "support.tickets.create",
    "support.tickets.reply",
    "support.tickets.note",
    "support.tickets.assign",
    "support.tickets.escalate",
    "support.tickets.close",
    "support.rules.manage",
    "students.read",
    "students.restrict",
    "kb.manage",
    "email.templates.read",
    "logs.read",
    "institutions.manage",
  ],

  support_agent: [
    "support.tickets.read",
    "support.tickets.create",
    "support.tickets.reply",
    "support.tickets.note",
    "students.read",
    "kb.manage",
  ],

  ai_ops: [
    "ai.providers.read",
    "ai.providers.manage",
    "ai.budgets.manage",
    "logs.read",
    "system.manage",
  ],

  finance_admin: [
    "ai.providers.read",
    "ai.budgets.manage",
    "audit.read",
    "logs.read",
  ],

  content_editor: [
    "cms.edit",
    "cms.publish",
    "kb.manage",
    "email.templates.read",
    "email.templates.edit",
    "newsletter.manage",
  ],

  security_auditor: [
    "audit.read",
    "logs.read",
    "students.read",
    "team.read",
    "system.manage",
  ],
};

export function getRolePermissions(role: AdminRole): AdminPermission[] {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

export interface AdminAuthContext {
  user: User;
  role: AdminRole;
  permissions: AdminPermission[];
  isSuperAdmin: boolean;
}

/**
 * Who an operator is, read from the database and environment on every call, so a change
 * applies at the next request whatever the session says:
 *
 *  - ADMIN_EMAILS: always super_admin. Lives outside the database, so nothing in it can lock
 *    out the bootstrap operators.
 *  - An admin_team_members row decides everyone else: its role, or nothing if inactive.
 *    It outranks users.is_admin, so an operator can be restricted or deactivated.
 *  - users.is_admin with no row: super_admin, as existing operators are today.
 */
export async function getAdminContext(user: User): Promise<AdminAuthContext | null> {
  const [member] = await db
    .select()
    .from(adminTeamMembers)
    .where(eq(adminTeamMembers.userId, user.id));

  let role: AdminRole;
  if (isAdminEmail(user.email)) role = "super_admin";
  else if (member) {
    if (!member.isActive) return null;
    role = member.role;
  } else if (user.isAdmin) role = "super_admin";
  else return null;

  const known = new Set<string>(ALL_ADMIN_PERMISSIONS);
  // Only for a team member, and only names that exist: this column can't grant anything unexpected.
  const custom = (member?.customPermissions ?? []).filter((p): p is AdminPermission => known.has(p));

  return {
    user,
    role,
    permissions: Array.from(new Set([...(ROLE_PERMISSIONS[role] ?? []), ...custom])),
    isSuperAdmin: role === "super_admin",
  };
}

/**
 * Check if the current context has a specific permission.
 */
export function hasPermission(
  ctx: AdminAuthContext,
  permission: AdminPermission
): boolean {
  if (ctx.isSuperAdmin) return true;
  return ctx.permissions.includes(permission);
}

/** Any active operator, past the session-age and second-factor checks. Signed out → /login; not an operator → 404. */
export async function requireOperator(): Promise<AdminAuthContext> {
  const user = await getCurrentUser();
  const ctx = await getAdminContext(user);
  if (!ctx) notFound();
  // Sent to /admin-mfa, which offers a fresh sign-in.
  if (!isAdminSessionFresh((await auth())?.authTime)) redirect("/admin-mfa");
  await requireAdminMfa(user);
  return ctx;
}

/**
 * Strict server-side permission guard, for every admin page and action.
 * Throws notFound() if unauthorized to prevent disclosing admin routes.
 */
export async function requireAdminPermission(
  permission: AdminPermission
): Promise<AdminAuthContext> {
  const ctx = await requireOperator();
  if (!hasPermission(ctx, permission)) notFound();
  return ctx;
}

