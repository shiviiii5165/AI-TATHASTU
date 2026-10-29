import "server-only";

import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { ADMIN_ROLES, type AdminRole, adminTeamMembers, type User } from "@/db/schema";
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
 * Resolves the admin role and effective permissions for a given user.
 * Users listed in ADMIN_EMAILS or having users.isAdmin === true default to super_admin
 * unless an explicit admin_team_members record specifies another role.
 */
export async function getAdminContext(user: User): Promise<AdminAuthContext | null> {
  const isGlobalAdmin = user.isAdmin || isAdminEmail(user.email);

  // Check explicit team member assignment
  const [member] = await db
    .select()
    .from(adminTeamMembers)
    .where(eq(adminTeamMembers.userId, user.id));

  if (!isGlobalAdmin && (!member || !member.isActive)) {
    return null;
  }

  const role: AdminRole = member?.role ?? (isGlobalAdmin ? "super_admin" : "support_agent");
  const basePermissions = ROLE_PERMISSIONS[role] || [];
  const customPermissions = (member?.customPermissions as AdminPermission[]) || [];

  const effectivePermissions = Array.from(new Set([...basePermissions, ...customPermissions]));

  return {
    user,
    role,
    permissions: effectivePermissions,
    isSuperAdmin: role === "super_admin" || isGlobalAdmin,
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

/**
 * Strict server-side permission guard.
 * Throws notFound() if unauthenticated or unauthorized to prevent disclosing admin routes.
 */
export async function requireAdminPermission(
  permission: AdminPermission
): Promise<AdminAuthContext> {
  const user = await getCurrentUser();
  const ctx = await getAdminContext(user);

  if (!ctx || !hasPermission(ctx, permission)) {
    notFound();
  }

  return ctx;
}

