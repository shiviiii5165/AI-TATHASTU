import { connection, NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { queueHealth } from "@/lib/admin/health";
import { isCronCall } from "@/lib/internal-auth";

// Thresholds (queue age 15 min, any stuck job, 25 failures/hour) live in lib/admin/health.ts.

/**
 * Queue state for an uptime monitor (Bearer CRON_SECRET or INTERNAL_API_SECRET):
 * 200 while healthy, 503 with the reasons otherwise. Counts only, no user data.
 * A `failed` job is the dead letter: it stays in `jobs` with its last_error.
 */
export const GET = guarded(async (request: Request) => {
  await connection();
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Shared with the admin Operational Health page (lib/admin/health.ts); output unchanged.
  const { health, alerts } = await queueHealth();
  return NextResponse.json({ ...health, alerts }, { status: alerts.length ? 503 : 200, headers: { "Cache-Control": "no-store" } });
});
