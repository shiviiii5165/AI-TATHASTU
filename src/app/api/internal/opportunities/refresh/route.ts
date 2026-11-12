import { connection, NextResponse } from "next/server";

import { db } from "@/db";
import { isCronCall } from "@/lib/internal-auth";
import { refreshDueSources, type OppDb } from "@/lib/opportunities/ingest";

/**
 * Scheduled research-opportunity refresh (vercel.json cron; Bearer CRON_SECRET, or Bearer
 * INTERNAL_API_SECRET for operators and the worker). Refreshes every enabled source that is due
 * (per-source interval, backoff and lease prevent extra or overlapping fetches), then expires past
 * deadlines, demotes stale verification and checks a bounded batch of links. Safe to call often:
 * calling it every hour still fetches each source at most once per its interval.
 * Responds with counts and short error codes only.
 */
export const maxDuration = 300;

async function handle(request: Request) {
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await connection();
  try {
    const r = await refreshDueSources(db as unknown as OppDb);
    return NextResponse.json(r);
  } catch (err) {
    // e.g. migration 0028 not applied yet
    console.error("[opportunities-refresh] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "refresh_failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
