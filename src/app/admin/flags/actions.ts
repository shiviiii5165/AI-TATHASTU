"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { featureFlags } from "@/db/schema";
import { requireAdmin } from "@/lib/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";

export async function toggleFlagAction(formData: FormData) {
  const admin = await requireAdmin();
  await requireAdminPermission("flags.manage");

  const key = String(formData.get("key") || "").trim();
  if (!key) return;

  const currentEnabled = formData.get("enabled") === "true";
  const nextEnabled = !currentEnabled;

  await db
    .update(featureFlags)
    .set({
      enabled: nextEnabled,
      updatedBy: admin.email || "admin",
      updatedAt: new Date(),
    })
    .where(eq(featureFlags.key, key));

  await recordAdminAudit({
    actorEmail: admin.email || "admin",
    action: "flag.toggle",
    resource: "feature_flags",
    targetId: key,
    details: { previous: currentEnabled, next: nextEnabled },
  });

  revalidatePath("/admin/flags");
}
