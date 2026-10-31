import { createHash } from "node:crypto";

import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { db } from "@/db";
import { jobs, profileViews } from "@/db/schema";
import { guarded } from "@/lib/api-guard";
import { getApiOnboardedUser } from "@/lib/dal";

export type DashboardStatus = {
  /** profile_views exists: the dashboard can render. */
  ready: boolean;
  /** Latest compute_intelligence job for this user, if any. */
  job: "queued" | "running" | "done" | "failed" | "needs_review" | null;
};

/**
 * Readiness of the signed-in user's computed dashboard, for the "Personalizing
 * your dashboard…" poller. Minimal payload, always scoped to the session user,
 * ETag-gated so an unchanged status answers 304 with no body.
 */
export const GET = guarded(async (request: Request) => {
  const authz = await getApiOnboardedUser();
  if (!authz.ok) return NextResponse.json({ error: authz.error }, { status: authz.status });
  const userId = authz.user.id;

  const [[view], [job]] = await Promise.all([
    db.select({ userId: profileViews.userId }).from(profileViews).where(eq(profileViews.userId, userId)),
    db
      .select({ status: jobs.status })
      .from(jobs)
      .where(and(eq(jobs.userId, userId), eq(jobs.type, "compute_intelligence")))
      .orderBy(desc(jobs.createdAt))
      .limit(1),
  ]);
  const status: DashboardStatus = { ready: Boolean(view), job: job?.status ?? null };

  const body = JSON.stringify(status);
  const etag = `W/"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache" };
  if (request.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(body, { status: 200, headers: { ...headers, "Content-Type": "application/json" } });
});
