"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin";
import { updateAiBudgetPolicy } from "@/lib/admin/ai-ops";
import { requireAdminPermission } from "@/lib/admin/rbac";

const dollars = z.coerce.number().finite().min(0).max(1_000_000);
const policySchema = z.object({
  budgetUsd: dollars,
  userDailyUsd: dollars,
  userMonthlyUsd: dollars,
  warningPercent: z.coerce.number().int().min(50).max(100),
});

export async function updateBudgetPolicyAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminPermission("ai.budgets.manage");

  const parsed = policySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Enter valid amounts." };

  try {
    await updateAiBudgetPolicy(parsed.data, admin.email || "admin");
    revalidatePath("/admin/ai-ops/costs");
    revalidatePath("/admin");
    return { ok: true };
  } catch (err: unknown) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to update budget" };
  }
}
