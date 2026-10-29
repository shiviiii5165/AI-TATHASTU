"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { executeStudentDeletionWorkflow, revokeStudentSessions } from "@/lib/admin/students";

export async function revokeStudentSessionsAction(userId: string) {
  const admin = await requireAdmin();
  await requireAdminPermission("students.sessions.revoke");

  try {
    const res = await revokeStudentSessions(userId, admin.email || "admin");
    revalidatePath(`/admin/students/${userId}`);
    revalidatePath("/admin/students");
    return { ok: true, revokedCount: res.revokedCount };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to revoke sessions" };
  }
}

export async function executeStudentDeletionAction(userId: string, reason: string) {
  const admin = await requireAdmin();
  await requireAdminPermission("students.delete.approve");

  if (!reason.trim()) {
    return { ok: false, error: "A documented deletion reason is required for compliance." };
  }

  try {
    const res = await executeStudentDeletionWorkflow(userId, admin.email || "admin", reason);
    revalidatePath(`/admin/students/${userId}`);
    revalidatePath("/admin/students");
    return { ok: true, message: res.message };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to execute deletion workflow" };
  }
}

