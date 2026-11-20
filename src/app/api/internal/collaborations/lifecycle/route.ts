import { connection, NextResponse } from "next/server";

import { runLifecycle } from "@/lib/collaborations/lifecycle";
import { isCronCall } from "@/lib/internal-auth";

/**
 * Daily Collaborations lifecycle (Bearer CRON_SECRET, or INTERNAL_API_SECRET): renewal reminders on days 45 and 55,
 * expiry on day 60, and flagging collaborations whose owner is gone or inactive for an administrator.
 * Idempotent: running it twice in a day changes nothing the second time. Needs a scheduler entry; see the report.
 */
export const maxDuration = 120;

async function handle(request: Request) {
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connection();
  try {
    return NextResponse.json(await runLifecycle());
  } catch (err) {
    console.error("[collaborations-lifecycle] failed:", err instanceof Error ? err.name : err);
    return NextResponse.json({ error: "lifecycle_failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
