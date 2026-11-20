"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { requireAdminPermission } from "@/lib/admin/rbac";
import { repairMissingProfiles } from "@/lib/integrations/repair";
import { dispatchWebhooks } from "@/lib/integrations/webhooks";

const input = z.object({ clientId: z.enum(["collaborate", "avasar"]), apply: z.enum(["0", "1"]) });

export type RepairActionResult = { ok: true; dryRun: boolean; candidates: number; queued: number; byCause: Record<string, number> } | { ok: false; error: string };

/**
 * Re-sends profiles to an app for linked users it has no confirmed profile for (repair.ts). Never changes consent
 * and never touches users who haven't linked the app; existing-user backfill stays an operator script with a dry run.
 * Bounded to 50 users per click. Audited, including dry runs.
 */
export async function repairProfilesAction(_: RepairActionResult | null, formData: FormData): Promise<RepairActionResult> {
  const admin = await requireAdmin();
  await requireAdminPermission("system.manage");
  const parsed = input.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, error: "Unknown app." };
  const apply = parsed.data.apply === "1";
  const result = await repairMissingProfiles(parsed.data.clientId, { apply, limit: 50 });
  const byCause = result.candidates.reduce<Record<string, number>>((a, c) => ((a[c.cause] = (a[c.cause] ?? 0) + 1), a), {});
  await recordAdminAudit({
    actorId: admin.id,
    actorEmail: admin.email || "admin",
    action: apply ? "integration.repair" : "integration.repair_dry_run",
    resource: "integration_sync",
    targetId: parsed.data.clientId,
    details: { candidates: result.candidates.length, queued: result.queued, byCause },
  });
  if (apply && result.queued) after(() => dispatchWebhooks(100).catch((e) => console.error("webhook dispatch failed", e)));
  revalidatePath("/admin/intelligence/integrations");
  return { ok: true, dryRun: !apply, candidates: result.candidates.length, queued: result.queued, byCause };
}
