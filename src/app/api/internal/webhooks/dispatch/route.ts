import { and, eq, inArray, lt, notInArray } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { accountDeletions, integrationAuthCodes, rateLimits, users, verificationTokens, webhookOutbox } from "@/db/schema";
import { processDueDeletions } from "@/lib/account-deletion";
import { purgeOldAiUsage } from "@/lib/admin/ai-ops";
import { AUTO_PROVISION_CLIENTS } from "@/lib/integrations/auto-provision";
import { clientById } from "@/lib/integrations/clients";
import { reconcileProfileSyncs } from "@/lib/integrations/reconcile";
import { repairMissingProfiles } from "@/lib/integrations/repair";
import { dispatchWebhooks } from "@/lib/integrations/webhooks";
import { isCronCall } from "@/lib/internal-auth";

/**
 * Sends due webhooks, including retries, and purges old authorization codes. Vercel Cron calls it daily
 * (vercel.json, Bearer CRON_SECRET); the worker or an operator can call it
 * any time with Bearer INTERNAL_API_SECRET.
 */
async function handle(request: Request) {
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // First, so the integration.revoked rows it queues go out in this same run.
  const deletions = await processDueDeletions();
  // Per app with profile sync configured: profiles recomputed since the app last heard (the worker's own
  // notification can fail silently), then linked users the app has no confirmed profile for (repair.ts).
  const reconciledByApp: Record<string, unknown> = {};
  const repaired: Record<string, number> = {};
  let reconciled = { queued: 0, byCause: {} as Record<string, number> };
  for (const clientId of AUTO_PROVISION_CLIENTS) {
    const client = clientById(clientId);
    if (!client?.webhookUrl || !client.webhookSecret) continue;
    const r = await reconcileProfileSyncs(clientId);
    reconciledByApp[clientId] = { queued: r.queued, byCause: r.byCause };
    if (clientId === "collaborate") reconciled = { queued: r.queued, byCause: r.byCause };
    repaired[clientId] = (await repairMissingProfiles(clientId, { apply: true, limit: 50 })).queued;
  }
  const result = await dispatchWebhooks(100);
  // Codes live 60 seconds; keep a day for debugging, then drop them.
  const purged = await db
    .delete(integrationAuthCodes)
    .where(lt(integrationAuthCodes.expiresAt, new Date(Date.now() - 24 * 3600_000)))
    .returning({ codeHash: integrationAuthCodes.codeHash });
  // Both grow one row per key or address forever otherwise, and strangers can create them.
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  await purgeOldAiUsage();
  const [counters, tokens] = await db.batch([
    // Two days: a sliding limit's day-long window can still be counting a day-old hit.
    db.delete(rateLimits).where(lt(rateLimits.windowStart, new Date(Date.now() - 2 * 24 * 3600_000))).returning({ key: rateLimits.key }),
    db.delete(verificationTokens).where(lt(verificationTokens.expires, dayAgo)).returning({ token: verificationTokens.token }),
    // The audit log is the lasting record; these only hold a deleted user's id, and a month is ample for support.
    db.delete(accountDeletions).where(and(eq(accountDeletions.status, "completed"), lt(accountDeletions.completedAt, new Date(Date.now() - 30 * 24 * 3600_000)))),
    db.delete(webhookOutbox).where(and(inArray(webhookOutbox.status, ["delivered", "failed"]), lt(webhookOutbox.createdAt, new Date(Date.now() - 30 * 24 * 3600_000)), notInArray(webhookOutbox.userId, db.select({ id: users.id }).from(users)))),
  ]);
  return NextResponse.json({ ...result, deletions, reconciled: { queued: reconciled.queued, byCause: reconciled.byCause }, reconciledByApp, repaired, purgedCodes: purged.length, purgedRateLimits: counters.length, purgedTokens: tokens.length });
}

export const GET = handle;
export const POST = handle;
