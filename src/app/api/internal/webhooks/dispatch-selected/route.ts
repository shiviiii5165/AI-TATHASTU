import { NextResponse } from "next/server";

import { dispatchSelectedProfileUpdates, SELECTED_DISPATCH_MAX } from "@/lib/integrations/webhooks";
import { isInternalCall } from "@/lib/internal-auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/internal/webhooks/dispatch-selected — operator-only, for a controlled backfill.
 *   Authorization: Bearer INTERNAL_API_SECRET   (the cron secret is NOT accepted)
 *   { "userIds": ["<full uuid>", ...], "apply": false }
 *
 * Sends only pending Collaborate profile.updated rows for the listed users (active, onboarded,
 * linked). Never runs account deletions, cleanup, or any other user's or event's webhook.
 * Dry run unless "apply": true. Full UUIDs only (no prefixes), at most 50 per call.
 */
export async function POST(request: Request) {
  if (!isInternalCall(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { userIds?: unknown; apply?: unknown } | null;
  const userIds = Array.isArray(body?.userIds) ? body.userIds : null;
  if (!userIds || !userIds.length || userIds.length > SELECTED_DISPATCH_MAX || !userIds.every((u) => typeof u === "string" && UUID.test(u))) {
    return NextResponse.json({ error: `userIds must be 1-${SELECTED_DISPATCH_MAX} full UUIDs` }, { status: 422 });
  }
  const apply = body?.apply === true;
  const result = await dispatchSelectedProfileUpdates("collaborate", userIds.map((u) => (u as string).toLowerCase()), { apply });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
