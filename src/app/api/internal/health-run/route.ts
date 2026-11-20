import { connection, NextResponse } from "next/server";

import { guarded } from "@/lib/api-guard";
import { runAndRecordHealth } from "@/lib/admin/monitoring";
import { isCronCall } from "@/lib/internal-auth";

/**
 * Scheduled health run (Bearer CRON_SECRET or INTERNAL_API_SECRET): runs every platform check, stores the results
 * (monitoring_checks), syncs incidents and prunes old monitoring rows. Counts and statuses only, no user data.
 * Schedule it every 5–15 minutes (see the report: vercel.json cron or an external scheduler).
 */
export const GET = guarded(async (request: Request) => {
  await connection();
  if (!isCronCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await runAndRecordHealth();
  return NextResponse.json(
    { recorded: r.recorded, incidents: r.incidents, components: r.checks.map((c) => ({ id: c.id, status: c.status })) },
    { headers: { "Cache-Control": "no-store" } },
  );
});
