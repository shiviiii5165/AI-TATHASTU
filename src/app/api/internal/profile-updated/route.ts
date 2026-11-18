import { eq } from "drizzle-orm";
import { after, NextResponse } from "next/server";

import { db } from "@/db";
import { onboardingState } from "@/db/schema";
import { dispatchWebhooks, enqueueProfileUpdated } from "@/lib/integrations/webhooks";
import { isInternalCall } from "@/lib/internal-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/internal/profile-updated { userId, reason } — the worker calls
 * this after compute_intelligence rewrites a profile (new facts, ERIS,
 * projects). Queues profile.updated for the user's linked apps and sends it.
 */
export async function POST(request: Request) {
  if (!isInternalCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { userId?: unknown; reason?: unknown } | null;
  const userId = typeof body?.userId === "string" && UUID.test(body.userId) ? body.userId : null;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 422 });
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 100) : "profile_recomputed";

  // Profiles are also computed before onboarding is finished (for admins' Student Intelligence). Linked apps hear
  // about a profile only once the student has finished onboarding and reviewed what they share.
  const [state] = await db.select({ step: onboardingState.currentStep }).from(onboardingState).where(eq(onboardingState.userId, userId));
  if (state?.step !== "done") return NextResponse.json({ queued: [], skipped: "onboarding_incomplete" });

  const queued = await enqueueProfileUpdated(userId, reason);
  if (queued.length) after(() => dispatchWebhooks().catch((e) => console.error("webhook dispatch failed", e)));
  return NextResponse.json({ queued });
}
