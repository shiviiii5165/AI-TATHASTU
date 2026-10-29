"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin";
import { updateAiBudgetPolicy } from "@/lib/admin/ai-ops";
import { requireAdminPermission } from "@/lib/admin/rbac";

export async function updateBudgetPolicyAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminPermission("ai.budgets.manage");

  const budgetUsd = String(formData.get("budgetUsd") || "100.00").trim();
  const warningPercent = Number(formData.get("warningPercent") || 80);
  const hardLimit = formData.get("hardLimit") === "on";

  try {
    await updateAiBudgetPolicy(budgetUsd, warningPercent, hardLimit, admin.email || "admin");
    revalidatePath("/admin/ai-ops/costs");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update budget" };
  }
}

