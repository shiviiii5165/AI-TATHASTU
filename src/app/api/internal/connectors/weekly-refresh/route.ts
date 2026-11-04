import { NextResponse } from "next/server";

import { isCronCall } from "@/lib/internal-auth";
import { provisionPendingUsers, queueWeeklyRefresh } from "@/lib/integrations/auto-provision";
import { dispatchWebhooks } from "@/lib/integrations/webhooks";

/**
 * Weekly (vercel.json, Bearer CRON_SECRET; operators may use Bearer INTERNAL_API_SECRET):
 *  1. queue a re-sync of every connected source not synced in 6 days (activity stays current),
 *  2. provision Collaborate profiles for users who never made a choice (COLLABORATE_AUTO_PROVISION=1),
 *  3. send the resulting webhooks.
 */
async function handle(request: Request) {
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const syncsQueued = await queueWeeklyRefresh();
  const provisioned = await provisionPendingUsers();
  const webhooks = await dispatchWebhooks(100);
  return NextResponse.json({ syncsQueued, provisioned, webhooks });
}

export const GET = handle;
