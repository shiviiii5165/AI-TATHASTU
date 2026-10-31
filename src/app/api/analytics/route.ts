import { connection, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { logEvent } from "@/lib/analytics";
import { guarded } from "@/lib/api-guard";
import { hitRateLimit } from "@/lib/rate-limit";

// Client-side events only; searches are logged by the search API itself.
const schema = z.object({
  event: z.literal("institution_select"),
  properties: z
    .object({
      institutionId: z.uuid().optional(),
      other: z.boolean().optional(),
      rank: z.number().int().min(0).max(50).optional(),
      queryLength: z.number().int().min(0).max(100).optional(),
    })
    .strict(),
});

/** POST /api/analytics { event, properties } — allow-listed events and fields only. */
export const POST = guarded(async (request: Request) => {
  await connection();
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  // Each accepted event is a row; a client must not be able to write them unbounded.
  const limited = await hitRateLimit(`analytics:${session.user.id}`, { limit: 60, windowSeconds: 60 });
  if (!limited.ok) return new NextResponse(null, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Unknown event." }, { status: 422 });
  await logEvent(parsed.data.event, parsed.data.properties, session.user.id);
  return new NextResponse(null, { status: 204 });
});
