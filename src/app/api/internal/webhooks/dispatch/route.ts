import { lt } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { integrationAuthCodes, rateLimits, verificationTokens } from "@/db/schema";
import { dispatchWebhooks } from "@/lib/integrations/webhooks";
import { isCronCall } from "@/lib/internal-auth";

/**
 * Sends due webhooks, including retries, and purges old authorization codes. Vercel Cron calls it daily
 * (vercel.json, Bearer CRON_SECRET); the worker or an operator can call it
 * any time with Bearer INTERNAL_API_SECRET.
 */
async function handle(request: Request) {
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await dispatchWebhooks(100);
  // Codes live 60 seconds; keep a day for debugging, then drop them.
  const purged = await db
    .delete(integrationAuthCodes)
    .where(lt(integrationAuthCodes.expiresAt, new Date(Date.now() - 24 * 3600_000)))
    .returning({ codeHash: integrationAuthCodes.codeHash });
  // Both grow one row per key or address forever otherwise, and strangers can create them.
  const dayAgo = new Date(Date.now() - 24 * 3600_000);
  const [counters, tokens] = await db.batch([
    db.delete(rateLimits).where(lt(rateLimits.windowStart, dayAgo)).returning({ key: rateLimits.key }),
    db.delete(verificationTokens).where(lt(verificationTokens.expires, dayAgo)).returning({ token: verificationTokens.token }),
  ]);
  return NextResponse.json({ ...result, purgedCodes: purged.length, purgedRateLimits: counters.length, purgedTokens: tokens.length });
}

export const GET = handle;
export const POST = handle;
